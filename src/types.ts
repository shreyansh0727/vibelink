export type BuiltInPatternId =
  | 'tap'
  | 'double'
  | 'wave'
  | 'heartbeat'
  | 'ripple'
  | 'sos'
  | 'long';

export type BuzzPattern = BuiltInPatternId | 'custom';

export type PairMember = {
  uid: string;
  name: string;
  platform: 'android';
  online: boolean;
  joinedAt: number;
  lastSeen: number;
  lastDeliveredTrigger?: string;
  lastDeliveredAt?: number;
};

export type PairMeta = {
  createdAt: number;
  createdBy: string;
};

export type PairData = {
  meta: PairMeta;
  members: Record<string, PairMember>;
};

export type IncomingPulse = {
  id: string;
  pattern: string;
  label: string;
  fromName: string;
  receivedAt: number;
};

export type CustomPattern = {
  id: string;
  label: string;
  timings: number[];
  amplitudes: number[];
  createdAt: number;
};
