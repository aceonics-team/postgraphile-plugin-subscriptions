require("dotenv").config();
const pg = require("pg");
const { ApolloServer } = require("apollo-server");
const { makeSchemaAndPlugin } = require("postgraphile-apollo-server");
const { OperationHooksPlugin } = require("@graphile/operation-hooks");
const PgSubscriptionsPlugin = require("postgraphile-plugin-subscriptions");

const pgPool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  const { schema, plugin } = await makeSchemaAndPlugin(
    pgPool,
    'public',
    {
      appendPlugins: [
        // OperationHooksPlugin,
        PgSubscriptionsPlugin
      ],
    }
  );

  const server = new ApolloServer({
    schema,
    plugins: [plugin],
    tracing: true,
    debug: true
  });

  const { url } = await server.listen();
  console.log(`🚀 Server ready at ${url}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});