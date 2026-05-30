export const BIGQUERY_DATASET_DESCRIPTIONS = `
This project has the following key BigQuery dataset:
- \`analytics_518441997\`: This is the main analytics dataset containing application event data.

You should use \`listDatasets\` to confirm all available datasets and then query \`analytics_518441997.INFORMATION_SCHEMA.TABLES\` or \`analytics_518441997.INFORMATION_SCHEMA.COLUMNS\` to explore the schema.
`;
