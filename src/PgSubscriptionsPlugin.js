const { makePluginByCombiningPlugins } = require("graphile-utils");
const PgSubscriptionTypesPlugin = require('./PgSubscriptionTypesPlugin');
const PgSubscriptionInflectionPlugin = require('./PgSubscriptionInflectionPlugin');
const PgMutationTriggersPlugin = require('./PgMutationTriggersPlugin');
const PgSubscriptionAllRowsPlugin = require('./PgSubscriptionAllRowsPlugin');
const PgSubscriptionRowByUniqueConstraintPlugin = require('./PgSubscriptionRowByUniqueConstraintPlugin');

const PgSubscriptionsPlugin = makePluginByCombiningPlugins(
  PgSubscriptionTypesPlugin,
  PgSubscriptionInflectionPlugin,
  PgMutationTriggersPlugin,
  PgSubscriptionAllRowsPlugin,
  PgSubscriptionRowByUniqueConstraintPlugin
  // TODO: Create and Add live queries plugin (NotYetImplementd)
);

module.exports = PgSubscriptionsPlugin;