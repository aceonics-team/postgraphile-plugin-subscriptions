const pubSub = require("./pubsub");

const PgSubscriptionByEventPlugin = (builder) => {
  builder.hook('GraphQLObjectType:fields', (fields, build, hookContext) => {
    const {
      extend,
      getTypeByName,
      newWithHooks,
      pgIntrospectionResultsByKind,
      graphql: {
        GraphQLObjectType,
        GraphQLString,
        GraphQLList,
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
        const fieldName = inflection.allSubscriptionRows(table);
        
        const PayloadType = newWithHooks(
          GraphQLObjectType,
          {
            name: `${tableTypeName}SubscriptionPayload`,
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

        memo = build.extend(
          memo,
          {
            [fieldName]: fieldWithHooks(
              fieldName,
              context => {
                return {
                  description: `Subscribes mutations on \`${tableTypeName}\`.`,
                  type: PayloadType,
                  subscribe: () => pubSub.asyncIterator(`postgraphile:${tableName}`),
                  resolve: (data) => {
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

module.exports = PgSubscriptionByEventPlugin;