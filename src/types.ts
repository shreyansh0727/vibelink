export type BuiltInPatternId =
  | 'tap'
  | 'double'
  | 'snap'
  | 'knock'
  | 'wave'
  | 'heartbeat'
  | 'pendulum'
  | 'ripple'
  | 'crescendo'
  | 'rain'
  | 'sonar'
  | 'shiver'
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

export type SharedRhythm = {
  id: string;
  from: string;
  fromName: string;
  label: string;
  timings: number[];
  amplitudes: number[];
  createdAt: number;
};
