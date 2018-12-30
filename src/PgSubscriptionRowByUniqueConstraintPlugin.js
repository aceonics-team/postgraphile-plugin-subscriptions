const pubSub = require("./pubsub");

const PgSubscriptionByUniqueConstraintPlugin = (builder) => {
  builder.hook('GraphQLObjectType:fields', (fields, build, hookContext) => {
    const {
      extend,
      getTypeByName,
      newWithHooks,
      pgIntrospectionResultsByKind,
      pgGetGqlInputTypeByTypeIdAndModifier,
      graphql: {
        GraphQLInputObjectType,
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
        const payloadName = inflection.subscribePayloadType(table);

        const uniqueConstraints = table.constraints.filter(
          con => con.type === "u" || con.type === "p"
        );

        uniqueConstraints.forEach(constraint => {
          const keys = constraint.keyAttributes;
          const inputName = inflection.subscriptionRowByUniqueKeys(
            keys,
            table,
            constraint
          );
          const fieldName = inflection.subscriptionRowByUniqueKeys(
            keys,
            table,
            constraint
          );

          const inputType = newWithHooks(
            GraphQLInputObjectType,
            {
              name: inputName,
              description: '',
              fields: keys.reduce((memo, key) => {
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
              },
                {
                  mutation_in: {
                    description: `All input for the \`${tableTypeName}\` subscription.`,
                    type: new GraphQLList(getTypeByName('MutationType')),
                  }
                }),
            },
            {
              isPgSubscriptionRowByUniqueConstraintInputType: true,
              pgInflection: table,
            }
          );

          memo[fieldName] = fieldWithHooks(
            fieldName,
            context => {
              return {
                description: `Subscribes mutations on \`${tableTypeName}\`.`,
                type: getTypeByName(payloadName),
                args: {
                  input: {
                    type: inputType
                  }
                },
                subscribe: (...subscriptionParams) => {
                  const SUBSCRIBE_ARGS_INDEX = 1;
                  const { input } = subscriptionParams[
                    SUBSCRIBE_ARGS_INDEX
                  ];
                  if (!input.mutation_in || !input.mutation_in.length) {
                    input.mutation_in = [];
                    input.mutation_in.push('CREATED', 'UPDATED', 'DELETED');
                  }
                  const topics = [];
                  input.mutation_in.forEach(mutationType => {
                    keys.forEach(key => {
                      topics.push(`postgraphile:${mutationType.toLowerCase()}:${tableName}:${key.name}:${input[key.name]}`)
                    });
                  });

                  return pubSub.asyncIterator(topics);
                },
                resolve: (data) => {
                  return data
                },
              };
            },
            {
              isPgSubscriptionRowByUniqueConstraint: true,
              pgFieldIntrospection: table
            },
          );
        });

        return memo;
      }, {}),
    );
  });
};

module.exports = PgSubscriptionByUniqueConstraintPlugin;