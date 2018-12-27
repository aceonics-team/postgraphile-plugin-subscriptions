const pubSub = require("./pubsub");

const PgSubscriptionByUniqueConstraintPlugin = (builder) => {
  builder.hook('GraphQLObjectType:fields', (fields, build, hookContext) => {
    const {
      extend,
      getTypeByName,
      pgIntrospectionResultsByKind,
      pgGetGqlInputTypeByTypeIdAndModifier,
      graphql: {
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

          memo[fieldName] = fieldWithHooks(
            fieldName,
            context => {
              return {
                description: `Subscribes mutations on \`${tableTypeName}\`.`,
                type: getTypeByName(`${tableTypeName}SubscriptionPayload`),
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