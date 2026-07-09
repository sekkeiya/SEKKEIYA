// SEKKEIYA コネクタ（外部サービス連携）の型定義

export type ConnectorId = 'google_calendar' | 'notion' | 'slack';

export interface ConnectorToken {
  accessToken:  string;
  refreshToken: string;
  expiresAt:    number;  // Unix ms
  scope:        string;
  connectedAt?: any;     // Firestore serverTimestamp
}

export interface ConnectorStatus {
  id:          ConnectorId;
  label:       string;
  description: string;
  icon:        string;          // SVG path or emoji fallback
  isConnected: boolean;
  userEmail?:  string;         // Google アカウントのメール（接続後）
  error?:      string;
}
