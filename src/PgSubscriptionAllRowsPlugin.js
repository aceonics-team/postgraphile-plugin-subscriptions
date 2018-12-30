const pubSub = require("./pubsub");

const PgSubscriptionByEventPlugin = (builder) => {
  builder.hook('GraphQLObjectType:fields', (fields, build, hookContext) => {
    const {
      extend,
      getTypeByName,
      newWithHooks,
      parseResolveInfo,
      pgIntrospectionResultsByKind,
      pgGetGqlTypeByTypeIdAndModifier,
      gql2pg,
      pgSql: sql,
      graphql: {
        GraphQLInputObjectType,
        GraphQLObjectType,
        GraphQLString,
        GraphQLList,
        GraphQLNonNull
      },
      pgQueryFromResolveData: queryFromResolveData,
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
        const tableType = pgGetGqlTypeByTypeIdAndModifier(table.type.id, null);
        const fieldName = inflection.allSubscriptionRows(table);
        const inputName = inflection.subscribeAllRowsInputType(table);
        const payloadName = inflection.subscribePayloadType(table);
        const sqlFullTableName = sql.identifier(
          table.namespace.name,
          table.name
        );

        const inputType = newWithHooks(
          GraphQLInputObjectType,
          {
            name: inputName,
            description: `Input for subscribing mutations on \`${tableTypeName}\`.`,
            fields: {
              mutation_in: {
                description: `All input for the \`${tableTypeName}\` subscription.`,
                type: new GraphQLList(getTypeByName('MutationType')),
              }
            }
          },
          {
            isPgSubscriptionAllRowsInputType: true,
            pgInflection: table,
          }
        );

        const payloadType = newWithHooks(
          GraphQLObjectType,
          {
            name: payloadName,
            description: `The output of our \`${tableTypeName}\` subscription.`,
            fields: {
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
            },
          },
          {
            isPgSubscriptionAllRowsPayloadType: true,
            pgIntrospection: table,
          },
        );

        memo = build.extend(
          memo,
          {
            [fieldName]: fieldWithHooks(
              fieldName,
              ({ getDataFromParsedResolveInfoFragment }) => {
                return {
                  description: `Subscribes mutations on \`${tableTypeName}\`.`,
                  type: payloadType,
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
                      topics.push(`postgraphile:${mutationType.toLowerCase()}:${table.name}`)
                    });

                    return pubSub.asyncIterator(topics);
                  },
                  async resolve(data, args, context, resolveInfo) {
                    // TODO: Fix below after pgClient is available
                    // if (data.mutationType !== 'DELETED') {
                    //   const parsedResolveInfoFragment = parseResolveInfo(
                    //     resolveInfo
                    //   );
                    //   const resolveData = getDataFromParsedResolveInfoFragment(
                    //     parsedResolveInfoFragment,
                    //     tableType
                    //   );
                    //   const query = queryFromResolveData(
                    //     sqlFullTableName,
                    //     undefined,
                    //     resolveData,
                    //     {},
                    //     queryBuilder => {
                    //       const keys = data.uniqueConstraint.keyAttributes;
                    //       keys.forEach(key => {
                    //         queryBuilder.where(
                    //           sql.fragment`${queryBuilder.getTableAlias()}.${sql.identifier(
                    //             key.name
                    //           )} = ${gql2pg(
                    //             args[inflection.column(key)],
                    //             key.type,
                    //             key.typeModifier
                    //           )}`
                    //         );
                    //       });
                    //     }
                    //   );
                    //   const { text, values } = sql.compile(query);
                    //   const {
                    //     rows: [row],
                    //   } = await context.pgClient.query(text, values);
                    //   data.currentRecord = row;
                    // } else {
                    //   data.currentRecord = null;
                    // }
                    data.changedFields = (data.currentRecord && data.previousRecord) ?
                      Object.keys(data.currentRecord).filter(k => data.currentRecord[k] !== data.previousRecord[k]) : []
                    // delete data.uniqueConstraint;
                    // delete data.uniqueKey;

                    return data
                  },
                };
              },
              {
                isPgSubscriptionAllRows: true,
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