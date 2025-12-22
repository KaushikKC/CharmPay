export interface Payment {
  id: string;
  amount: number;
  timestamp: string;
  status: "completed" | "pending" | "failed";
}

export interface Subscription {
  id: string;
  recipient: string;
  amountPerInterval: number;
  interval: string;
  totalLocked: number;
  remainingBalance: number;
  nextPaymentAt: string;
  status: "active" | "cancelled" | "completed";
  paymentHistory: Payment[];
  createdAt: string;
}

export const mockSubscriptions: Subscription[] = [
  {
    id: "sub_001",
    recipient: "bc1qcreator123",
    amountPerInterval: 0.001,
    interval: "30 days",
    totalLocked: 0.01,
    remainingBalance: 0.007,
    nextPaymentAt: "2025-01-15",
    status: "active",
    createdAt: "2024-12-01",
    paymentHistory: [
      {
        id: "pay_001",
        amount: 0.001,
        timestamp: "2024-12-15T10:00:00Z",
        status: "completed",
      },
      {
        id: "pay_002",
        amount: 0.001,
        timestamp: "2024-12-01T10:00:00Z",
        status: "completed",
      },
    ],
  },
  {
    id: "sub_002",
    recipient: "bc1qcreator456",
    amountPerInterval: 0.002,
    interval: "7 days",
    totalLocked: 0.02,
    remainingBalance: 0.014,
    nextPaymentAt: "2025-01-10",
    status: "active",
    createdAt: "2024-11-20",
    paymentHistory: [
      {
        id: "pay_003",
        amount: 0.002,
        timestamp: "2025-01-03T10:00:00Z",
        status: "completed",
      },
      {
        id: "pay_004",
        amount: 0.002,
        timestamp: "2024-12-27T10:00:00Z",
        status: "completed",
      },
      {
        id: "pay_005",
        amount: 0.002,
        timestamp: "2024-12-20T10:00:00Z",
        status: "completed",
      },
    ],
  },
];

export const mockCreatorSubscriptions = [
  {
    id: "sub_001",
    subscriber: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
    amountPerInterval: 0.001,
    interval: "30 days",
    totalLocked: 0.01,
    nextPaymentAt: "2025-01-15",
    status: "active",
    totalReceived: 0.003,
    paymentHistory: [
      {
        id: "pay_001",
        amount: 0.001,
        timestamp: "2024-12-15T10:00:00Z",
        status: "completed",
      },
      {
        id: "pay_002",
        amount: 0.001,
        timestamp: "2024-12-01T10:00:00Z",
        status: "completed",
      },
    ],
  },
];

