const pubSub = require("./pubsub");

const PgSubscriptionByUniqueConstraintPlugin = (builder) => {
  builder.hook('GraphQLObjectType:fields', (fields, build, hookContext) => {
    const {
      extend,
      getTypeByName,
      newWithHooks,
      pgIntrospectionResultsByKind,
      pgGetGqlTypeByTypeIdAndModifier,
      pgGetGqlInputTypeByTypeIdAndModifier,
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
        const TableType = pgGetGqlTypeByTypeIdAndModifier(table.type.id, null);

        const uniqueConstraints = table.constraints.filter(
          con => con.type === "u" || con.type === "p"
        );

        uniqueConstraints.forEach(constraint => {
          const PayloadType = newWithHooks(
            GraphQLObjectType,
            {
              name: `Subscription${tableTypeName}Payload`,
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
                      return data.currentRecord;
                    },
                  },
                  previousValues: {
                    description: `The previous value of \`${tableTypeName}\`.`,
                    type: tableType,
                    resolve(data) {
                      return data.previousRecord;
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

          const keys = constraint.keyAttributes;
          const fieldName = inflection.subscriptionRowByUniqueKeys(
            keys,
            table,
            constraint
          );

          memo[fieldName] = fieldWithHooks(
            fieldName,
            context => {
              return {
                description: `Subscribes mutations on \`${tableTypeName}\`.`,
                type: PayloadType,
                args: keys.reduce((memo, key) => {
                  const InputType = pgGetGqlInputTypeByTypeIdAndModifier(
                    key.typeId,
                    key.typeModifier
                  );
                  if (!InputType) {
                    throw new Error(
                      `Could not find input type for key '${
                      key.name
                      }' on type '${TableType.name}'`
                    );
                  }
                  memo[inflection.column(key)] = {
                    type: new GraphQLNonNull(InputType),
                  };
                  return memo;
                }, {}),
                subscribe: (...subscribeParams) => {
                  const RESOLVE_ARGS_INDEX = 1;
                  const args = subscribeParams[
                    RESOLVE_ARGS_INDEX
                  ];
                  const keyName = keys[0].name;
                  return pubSub.asyncIterator(`postgraphile:${tableName}:${keyName}:${args[keyName]}`, 'hello');
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
          );
        });

        return memo;
      }, {}),
    );
  });
};

module.exports = PgSubscriptionByUniqueConstraintPlugin;