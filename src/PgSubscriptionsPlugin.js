const { makeExtendSchemaPlugin, gql, makePluginByCombiningPlugins } = require("graphile-utils");
const { PubSub } = require("graphql-subscriptions");

const pubSub = new PubSub();

const AddMutationTypePlugin = makeExtendSchemaPlugin(build => {
  return {
    typeDefs: gql`
      enum MutationType {
        CREATED
        UPDATED
        DELETED
      }
    `,
    resolvers: {},
  };
});

const AddMutationTriggersOperationHook = build => fieldContext => {
  const {
    pgSql: sql,
  } = build;

  const {
    scope: {
      isRootMutation,
      pgFieldIntrospection: table,
      isPgCreateMutationField,
      isPgUpdateMutationField,
      isPgDeleteMutationField,
    },
    addArgDataGenerator,
  } = fieldContext;

  if (!isRootMutation) return null;

  let mutationType, previousUser, currentUser;

  if (isPgCreateMutationField) {
    mutationType = 'CREATED';
  } else if (isPgUpdateMutationField) {
    mutationType = 'UPDATED';
  } else if (isPgDeleteMutationField) {
    mutationType = 'DELETED';
  } else {
    return null;
  }

  addArgDataGenerator(() => ({
    pgQuery: queryBuilder => {
      queryBuilder.select(
        sql.query`${queryBuilder.getTableAlias()}.id`,
        '__RelatedNodeId',
      );
    },
  }));

  const getPreviousUser = async (input, args, context, resolveInfo) => {
    if (isPgCreateMutationField) {
      previousUser = null;
      return input;
    } else {
      const { rows: [row] } = await context.pgClient.query(
        // TODO: Check if we can avoid using * in query
        // TODO: Does not work if mutation is done via nodeId or any other unique key
        `select * from ${table.namespaceName}.${table.name} where id = $1`,
        [args.input.id]
      );
      previousUser = row;
    }

    return input;
  };

  const getCurrentUser = async (input, args, context, resolveInfo) => {
    const relatedNodeId = input.data.__RelatedNodeId;
    if (isPgDeleteMutationField) {
      currentUser = null;
    } else {
      const { rows: [row] } = await context.pgClient.query(
        // TODO: Check if we can avoid using * in query
        `select * from ${table.namespaceName}.${table.name} where id = $1`,
        [relatedNodeId]
      );
      currentUser = row;
    }

    const payload = {
      clientMutationId: input.clientMutationId,
      mutationType,
      relatedNodeId,
      currentUser,
      previousUser,
      changedFields: (currentUser && previousUser) ?
        Object.keys(currentUser).filter(k => currentUser[k] !== previousUser[k]) : []
    };

    // TODO: Check whether creating multiple channels for filter is correct approach or not
    pubSub.publish(`postgraphile:${table.name}`, payload);
    pubSub.publish(`postgraphile:${table.name}:${relatedNodeId}`, payload);

    return input;
  };

  return {
    before: [
      {
        priority: 500,
        callback: getPreviousUser,
      },
    ],
    after: [
      {
        priority: 500,
        callback: getCurrentUser,
      },
    ],
    error: [],
  };
};

const AddMutationTriggersPlugin = (builder) => {
  builder.hook("init", (_, build) => {
    build.addOperationHook(AddMutationTriggersOperationHook(build));

    return _;
  });
};

const AddSubscriptionsPugin = (builder) => {
  builder.hook('GraphQLObjectType:fields', (fields, build, hookContext) => {
    const {
      extend,
      getTypeByName,
      newWithHooks,
      pgIntrospectionResultsByKind,
      graphql: {
        GraphQLInputObjectType,
        GraphQLObjectType,
        GraphQLString,
        GraphQLList,
        GraphQLID,
        GraphQLNonNull
      },
      inflection,
    } = build;

    const { scope: { isRootSubscription }, fieldWithHooks } = hookContext;

    if (!isRootSubscription) {
      return fields;
    }

    return extend(
      fields,
      pgIntrospectionResultsByKind.class.reduce((memo, table) => {
        if (!table.namespace) return memo;

        const tableName = inflection.tableFieldName(table);
        const tableTypeName = inflection.tableType(table);
        const tableType = getTypeByName(tableTypeName);

        const InputType = newWithHooks(
          GraphQLInputObjectType,
          {
            name: `${tableTypeName}SubscriptionCondition`,
            description: `All input for the subscribing \`${tableTypeName}\` changes.`,
            fields: {
              // TODO: subscription should support complete filter options just like prisma. 
              id: {
                description: `The globally unique \`ID\` which will identify a single \`${tableTypeName}\` for subscribing.`,
                type: GraphQLID,
              },
              // TODO: Add filter for mutation_in (NotYetImplemented)
              mutation_in: {
                description: `Mutation types to listen \`${tableTypeName}\` subscription.`,
                type: new GraphQLList(getTypeByName('MutationType')),
              },
            },
          },
          {
            pgInflection: table,
          }
        );

        const PayloadType = newWithHooks(
          GraphQLObjectType,
          {
            name: `Subscribe${tableTypeName}Payload`,
            description: `The output of our \`${tableTypeName}\` subscription.`,
            fields: () => {
              return {
                clientMutationId: {
                  description:
                    "The exact same `clientMutationId` that was provided in the mutation input, unchanged and unused. May be used by a client to track mutations.",
                  type: GraphQLString,
                  resolve(data) {
                    return data.clientMutationId;
                  },
                },
                mutation: {
                  description: 'Type of mutation occured',
                  type: new GraphQLNonNull(getTypeByName('MutationType')),
                  resolve(data) {
                    return data.mutationType;
                  },
                },
                relatedNodeId: {
                  description: 'ID of the mutated record',
                  type: new GraphQLNonNull(getTypeByName('ID')),
                  resolve(data) {
                    return data.relatedNodeId;
                  },
                },
                [tableName]: {
                  description: `The current value of \`${tableTypeName}\`.`,
                  type: tableType,
                  resolve(data) {
                    return data.currentUser;
                  },
                },
                previousValues: {
                  description: `The previous value of \`${tableTypeName}\`.`,
                  type: tableType,
                  resolve(data) {
                    return data.previousUser;
                  },
                },
                changedFields: {
                  description: `List of fields changed in mutation of \`${tableTypeName}\`.`,
                  type: new GraphQLNonNull(new GraphQLList(getTypeByName('String'))),
                  resolve(data) {
                    return data.changedFields;
                  }
                }
              };
            },
          },
          {
            pgIntrospection: table,
          },
        );

        const subscriptionName = `on${tableTypeName}Mutation`;
        memo = build.extend(
          memo,
          {
            [subscriptionName]: fieldWithHooks(
              subscriptionName,
              context => {
                return {
                  description: `Subscribes mutations on \`${tableTypeName}\`.`,
                  type: PayloadType,
                  args: {
                    input: {
                      type: InputType,
                    },
                  },
                  subscribe: (...subscribeParams) => {
                    // TODO: Check if this is correct place to implement filter with multiple channels.
                    const RESOLVE_ARGS_INDEX = 1;
                    // TODO: mutation_in is still not working (NotYetImplemented)
                    const { input } = subscribeParams[
                      RESOLVE_ARGS_INDEX
                    ];
                    let topic = `postgraphile:${tableName}`;
                    if (input && input.id) {
                      topic += `:${input.id}`;
                    }

                    return pubSub.asyncIterator(topic);
                  },
                  resolve: (data) => {
                    // TODO: Check if we can skip returning data depending on filters, 
                    // instead of creating separate channel per filter as done now for id 
                    return data
                  },
                };
              },
              {
                pgFieldIntrospection: table,
              },
            ),
          },
        );

        return memo;
      }, {}),
    );
  });
};

const PgSubscriptionsPlugin = makePluginByCombiningPlugins(
  AddMutationTypePlugin,
  AddMutationTriggersPlugin,
  AddSubscriptionsPugin,
  // TODO: Create and Add live queries plugin (NotYetImplementd)
);
module.exports = PgSubscriptionsPlugin;