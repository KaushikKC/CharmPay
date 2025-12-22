"use client";

import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { mockCreatorSubscriptions } from "@/lib/mockSubscriptions";

export default function CreatorPage() {
  const totalMonthlyIncome = mockCreatorSubscriptions.reduce(
    (sum, sub) => sum + sub.totalReceived,
    0
  );

  const allPayments = mockCreatorSubscriptions.flatMap(
    (sub) => sub.paymentHistory
  );

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Creator Dashboard</h1>
          <p className="text-white/60 font-light">
            View incoming subscriptions and payments
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card>
            <div className="space-y-2">
              <p className="text-sm text-white/60 font-light">
                Incoming Subscriptions
              </p>
              <p className="text-3xl font-semibold">
                {mockCreatorSubscriptions.length}
              </p>
            </div>
          </Card>

          <Card>
            <div className="space-y-2">
              <p className="text-sm text-white/60 font-light">
                Monthly BTC Income
              </p>
              <p className="text-3xl font-semibold">
                {totalMonthlyIncome.toFixed(4)} BTC
              </p>
            </div>
          </Card>

          <Card>
            <div className="space-y-2">
              <p className="text-sm text-white/60 font-light">Total Payments</p>
              <p className="text-3xl font-semibold">{allPayments.length}</p>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <h2 className="text-2xl font-semibold">Incoming Subscriptions</h2>

          {mockCreatorSubscriptions.length === 0 ? (
            <Card>
              <div className="text-center py-12">
                <p className="text-white/60">No incoming subscriptions</p>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {mockCreatorSubscriptions.map((subscription) => (
                <Card key={subscription.id}>
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <h3 className="text-lg font-semibold">
                            Subscription {subscription.id}
                          </h3>
                          <Badge
                            variant={
                              subscription.status === "active"
                                ? "active"
                                : "cancelled"
                            }
                          >
                            {subscription.status}
                          </Badge>
                        </div>

                        <div className="grid md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-white/60 font-light">Subscriber</p>
                            <p className="font-mono text-sm mt-1 break-all">
                              {subscription.subscriber.slice(0, 10)}...
                            </p>
                          </div>
                          <div>
                            <p className="text-white/60 font-light">
                              Amount/Interval
                            </p>
                            <p className="font-medium mt-1">
                              {subscription.amountPerInterval} BTC /{" "}
                              {subscription.interval}
                            </p>
                          </div>
                          <div>
                            <p className="text-white/60 font-light">
                              Total Received
                            </p>
                            <p className="font-medium mt-1">
                              {subscription.totalReceived.toFixed(4)} BTC
                            </p>
                          </div>
                          <div>
                            <p className="text-white/60 font-light">
                              Next Payment
                            </p>
                            <p className="font-medium mt-1">
                              {new Date(
                                subscription.nextPaymentAt
                              ).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/10">
                      <div className="mt-4">
                        <h4 className="text-sm font-semibold mb-3">Payment History</h4>
                        <div className="space-y-3">
                          {subscription.paymentHistory.map((payment) => (
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
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

