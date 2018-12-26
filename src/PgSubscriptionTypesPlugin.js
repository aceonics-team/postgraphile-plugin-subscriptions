const { makeExtendSchemaPlugin, gql } = require("graphile-utils");

const PgSubscriptionTypesPlugin = makeExtendSchemaPlugin(build => {
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

module.exports = PgSubscriptionTypesPlugin;