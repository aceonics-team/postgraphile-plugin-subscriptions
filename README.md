# Postgraphile Subscription Plugin

This plugin adds a subscription by default per table in your postGraphile schema; e.g.
`user` table gets subscription as `onUserMutation`. This plugin is not dependent on `@graphile/supporter` or `@graphile/pro` package. It uses `graphql-subscriptions` internally. 

Currently it can be used with apollo-server, as it has in built subscriptions. Check out example for more info. 

This is currently in alpha stage and has few issues which would resolved in near future.

## Features
With each mutation on table subscription returns following graphql result
* clientMutationId: Exact clientMutationId used while performing mutation.
* mutation: Type or mutation, value can be CREATED, UPDATED or DELETED.
* relatedNodeId: Id field of record on which mutation occured.
* node: Updated values for record after performing mutation.
* previousValues: Previous values for record before performing mutation. 
* changedFields: List of column names affected due to mutation.

## Install
For npm
```
npm install postgraphile-plugin-subscriptions --save
```
For yarn
```
yarn add postgraphile-plugin-subscriptions
```

## Usage

### Postgres Database
```
CREATE TABLE "users"(
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL unique,
  "firstName" TEXT,
  "lastName" TEXT,
  "mobile" TEXT,
  "role" USER_ROLE NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now(),
  "updatedAt" TIMESTAMPTZ DEFAULT now(),
  "archivedAt" TIMESTAMPTZ
);
```

### Server
```
const pg = require("pg");
const { ApolloServer } = require("apollo-server");
const { makeSchemaAndPlugin } = require("postgraphile-apollo-server");
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
```

### Client or GraphQL Playground
Subscribe to onUserMutation
```
subscription {
  onUserMutation {
    clientMutationId
    mutation
    relatedNodeId
    user {
      id
      firstName
      lastName
      email
      updatedAt
      createdAt
    }
    previousValues {
      id
      firstName
      lastName
      email
      updatedAt
      createdAt
    }
    changedFields 
  }
}
```

Perform Mutation
```
mutation {
  updateUserById(input: {
    clientMutationId: "my_custom_mutation_id"
    id: "e673ad33-dbd7-45a7-b272-3fefa25b4cba"
    userPatch: {
      firstName: "John",
      lastName: "Doe",
      email:"john@example.com",
    }
  }) {
    clientMutationId
    user {
      id
    }
  }
}
```

Subscription Output
```
{
  "data": {
    "onUserMutation": {
      "clientMutationId": "my_custom_mutation_id",
      "mutation": "UPDATED",
      "relatedNodeId": "e673ad33-dbd7-45a7-b272-3fefa25b4cba",
      "user": {
        "id": "e673ad33-dbd7-45a7-b272-3fefa25b4cba",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@example.com",
        "updatedAt": "Mon Dec 24 2018 12:55:20 GMT+0530 (GMT+05:30)",
        "createdAt": "Mon Dec 24 2018 12:50:14 GMT+0530 (GMT+05:30)"
      },
      "previousValues": {
        "id": "e673ad33-dbd7-45a7-b272-3fefa25b4cba",
        "firstName": "Jen",
        "lastName": "Doe",
        "email": "jen@example.com",
        "updatedAt": "Mon Dec 24 2018 12:50:14 GMT+0530 (GMT+05:30)",
        "createdAt": "Mon Dec 24 2018 12:50:14 GMT+0530 (GMT+05:30)"
      },
      "changedFields": [
        "firstName",
        "email"
        "updatedAt"
      ]
    }
  }
}
```