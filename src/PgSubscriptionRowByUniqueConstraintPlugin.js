const pubSub = require("./pubsub");

const PgSubscriptionByUniqueConstraintPlugin = (builder) => {
  builder.hook('GraphQLObjectType:fields', (fields, build, hookContext) => {
    const {
      extend,
      getTypeByName,
      pgIntrospectionResultsByKind,
      pgGetGqlInputTypeByTypeIdAndModifier,
      graphql: {
        GraphQLNonNull,
        GraphQLList
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

        const uniqueConstraints = table.constraints.filter(
          con => con.type === "u" || con.type === "p"
        );

        uniqueConstraints.forEach(constraint => {
          const keys = constraint.keyAttributes;
          const fieldName = inflection.subscriptionRowByUniqueKeys(
            keys,
            table,
            constraint
          );

          const args = keys.reduce((memo, key) => {
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
          }, {});

          args['mutation_in'] = {
            description: `All input for the \`${tableTypeName}\` subscription.`,
            type: new GraphQLList(getTypeByName('MutationType')),
          }

          memo[fieldName] = fieldWithHooks(
            fieldName,
            context => {
              return {
                description: `Subscribes mutations on \`${tableTypeName}\`.`,
                type: getTypeByName(`${tableTypeName}SubscriptionPayload`),
                args,
                subscribe: (...subscriptionParams) => {
                  const SUBSCRIBE_ARGS_INDEX = 1;
                  const args = subscriptionParams[
                    SUBSCRIBE_ARGS_INDEX
                  ];
                  if (!mutation_in.length) {
                    mutation_in.push('CREATED', 'UPDATED', 'DELETED');
                  }
                  const topics = [];
                  mutation_in.forEach(mutationType => {
                    topics.push(`postgraphile:${mutationType}:${table.name}`)
                  });

                  return pubSub.asyncIterator(topics);
                },
                subscribe: (...subscriptionParams) => {
                  const SUBSCRIBE_ARGS_INDEX = 1;
                  const args = subscriptionParams[
                    SUBSCRIBE_ARGS_INDEX
                  ];
                  if (!args.mutation_in || !args.mutation_in.length) {
                    args.mutation_in = [];
                    args.mutation_in.push('CREATED', 'UPDATED', 'DELETED');
                  }
                  const topics = [];
                  args.mutation_in.forEach(mutationType => {
                    keys.forEach(key => {
                      topics.push(`postgraphile:${mutationType.toLowerCase()}:${tableName}:${key.name}:${args[key.name]}`)
                    });
                  });

                  return pubSub.asyncIterator(topics);
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