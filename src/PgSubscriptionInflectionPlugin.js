const PgSubscriptionInflectionPlugin = (builder) => {
  builder.hook("inflection", (inflection, build) => {
    return build.extend(
      inflection,
      {
        allSubscriptionRows(table) {
          return this.camelCase(
            `on-all-${this.pluralize(this._singularizedTableName(table))}-mutation`
          );
        },
        allSubscriptionRowsSimple(table) {
          return this.camelCase(
            `on-all-${this.pluralize(this._singularizedTableName(table))}-list-mutation`
          );
        },
        subscriptionRow(table) {
          return this.camelCase(
            `on-${this._singularizedTableName(table)}-mutation`
          );
        },
        subscriptionRowByUniqueKeys(
          detailedKeys,
          table,
          constraint
        ) {
          if (constraint.tags.fieldName) {
            return constraint.tags.fieldName;
          }
          return this.camelCase(
            `on-${this._singularizedTableName(table)}-mutation-by-${detailedKeys
              .map(key => this.column(key))
              .join("-and-")}`
          );
        }
      }
    );
  });
};

module.exports = PgSubscriptionInflectionPlugin;