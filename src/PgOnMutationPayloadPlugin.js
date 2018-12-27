const pubSub = require("./pubsub");

const PgSubscriptionPayloadPlugin = (builder) => {
  builder.hook('GraphQLObjectType:fields', (fields, build, hookContext) => {
    const {
      extend,
      getTypeByName,
      newWithHooks,
      pgIntrospectionResultsByKind: table,
      graphql: {
        GraphQLObjectType,
        GraphQLString,
        GraphQLList,
        GraphQLNonNull
      },
      inflection,
    } = build;

    const { scope: { isRootSubscription } } = hookContext;

    if (!isRootSubscription) {
      return fields;
    }

    const tableName = inflection.tableFieldName(table);
    const tableTypeName = inflection.tableType(table);
    const tableType = getTypeByName(tableTypeName);

    return extend(
      fields,
      {
        [`${tableTypeName}SubscriptionPayload`]: fieldWithHooks(
          `${tableTypeName}SubscriptionPayload`,
          context => {
            return {
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
              }
            };
          }
        )
      },
    )
  });
};

module.exports = PgSubscriptionPayloadPlugin;