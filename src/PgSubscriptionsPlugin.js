const { makePluginByCombiningPlugins } = require("graphile-utils");
const PgSubscriptionTypesPlugin = require('./PgSubscriptionTypesPlugin');
const PgSubscriptionInflectionPlugin = require('./PgSubscriptionInflectionPlugin');
// const PgOnMutationPayloadPlugin = require('./PgOnMutationPayloadPlugin');
const PgMutationTriggersPlugin = require('./PgMutationTriggersPlugin');
const PgSubscriptionAllRowsPlugin = require('./PgSubscriptionAllRowsPlugin');
const PgSubscriptionRowByUniqueConstraintPlugin = require('./PgSubscriptionRowByUniqueConstraintPlugin');

const PgSubscriptionsPlugin = makePluginByCombiningPlugins(
  PgSubscriptionTypesPlugin,
  PgSubscriptionInflectionPlugin,
  // PgOnMutationPayloadPlugin,
  PgMutationTriggersPlugin,
  PgSubscriptionAllRowsPlugin,
  PgSubscriptionRowByUniqueConstraintPlugin
  // TODO: Create and Add live queries plugin (NotYetImplementd)
);

module.exports = PgSubscriptionsPlugin;