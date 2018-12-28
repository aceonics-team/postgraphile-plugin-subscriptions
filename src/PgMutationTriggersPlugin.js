const pubSub = require("./pubsub");

const PgMutationTriggersPlugin = (builder) => {
  builder.hook('GraphQLObjectType:fields:field', (field, build, hookContext) => {
    const {
      scope: {
        isRootMutation,
        pgFieldIntrospection: table,
        isPgCreateMutationField,
        isPgUpdateMutationField,
        isPgDeleteMutationField,
      }
    } = hookContext;

    if (!isRootMutation) {
      return field;
    }

    let mutationType, previousRecord, uniqueConstraint, uniqueKey;

    if (isPgCreateMutationField) {
      mutationType = 'CREATED';
    } else if (isPgUpdateMutationField) {
      mutationType = 'UPDATED';
    } else if (isPgDeleteMutationField) {
      mutationType = 'DELETED';
    } else {
      return field;
    }

    const uniqueConstraints = table.constraints.filter(
      con => con.type === "u" || con.type === "p"
    );

    const oldResolve = field.resolve;

    return {
      ...field,

      async resolve(_mutation, args, context, info) {
        uniqueConstraints.forEach(constraint => {
          constraint.keyAttributes.forEach(key => {
            if (args.input[key.name]) {
              uniqueConstraint = constraint;
              uniqueKey = key.name;
            }
          });
        });

        if (isPgCreateMutationField) {
          previousRecord = null;
        } else {
          const { rows: [row] } = await context.pgClient.query(
            // TODO: Check if we can avoid using * in query
            `select * from ${table.namespaceName}.${table.name} where ${uniqueKey} = $1`,
            [args.input[uniqueKey]]
          );
          previousRecord = row;
        }

        const oldResolveResult = await oldResolve(_mutation, args, context, info);
        
        const payload = {
          clientMutationId: args.input.clientMutationId,
          mutationType,
          previousRecord,
          uniqueConstraint,
          uniqueKey
        };

        // TODO: Check whether creating multiple channels for filter is correct approach or not
        pubSub.publish(`postgraphile:${table.name}`, payload);
        if (!isPgCreateMutationField) {
          uniqueConstraints.forEach(constraint => {
            constraint.keyAttributes.forEach(key => {
              pubSub.publish(`postgraphile:${table.name}:${key.name}:${previousRecord[key.name]}`, payload);
            });
          });
        }

        return oldResolveResult;
      },
    };
  });
};

module.exports = PgMutationTriggersPlugin;