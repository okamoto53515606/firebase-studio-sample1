import { BetaAnalyticsDataClient } from '@google-analytics/data';

let ga4Client: BetaAnalyticsDataClient | null = null;

export function getGA4Client(): BetaAnalyticsDataClient {
  if (!ga4Client) {
    ga4Client = new BetaAnalyticsDataClient();
    // ADC（Application Default Credentials）を自動使用します
  }
  return ga4Client;
}

export function getGA4PropertyId(): string {
  const propertyId = process.env.GA_PROPERTY_ID;
  if (!propertyId) {
    throw new Error('環境変数 GA_PROPERTY_ID が設定されていません');
  }
  return propertyId;
}
