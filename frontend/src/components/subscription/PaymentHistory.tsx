"use client";

import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { Payment } from "@/lib/mockSubscriptions";

interface PaymentHistoryProps {
  payments: Payment[];
}

export default function PaymentHistory({ payments }: PaymentHistoryProps) {
  if (payments.length === 0) {
    return (
      <Card>
        <p className="text-white/60 text-center py-8">No payment history</p>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="text-lg font-semibold mb-4">Payment History</h3>
      <div className="space-y-3">
        {payments.map((payment) => (
          <div
            key={payment.id}
            className="flex items-center justify-between py-3 border-b border-white/10 last:border-0"
          >
            <div className="flex-1">
              <p className="font-medium">{payment.amount} BTC</p>
              <p className="text-sm text-white/60 mt-1">
                {new Date(payment.timestamp).toLocaleString()}
              </p>
            </div>
            <Badge
              variant={
                payment.status === "completed"
                  ? "completed"
                  : payment.status === "pending"
                  ? "pending"
                  : "cancelled"
              }
            >
              {payment.status}
            </Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}

