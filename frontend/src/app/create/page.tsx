"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import BackgroundPattern from "@/components/ui/BackgroundPattern";

export default function CreatePage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    recipient: "",
    amountPerInterval: "",
    interval: "30 days",
    totalLocked: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate subscription creation
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // In a real app, this would create the subscription
    // For now, just redirect to dashboard
    router.push("/dashboard");
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen bg-black relative">
      <BackgroundPattern />
      <div className="relative z-10 max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Create Subscription</h1>
          <p className="text-white/60 font-light">
            Set up a new programmable Bitcoin subscription
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Recipient BTC Address"
              name="recipient"
              type="text"
              placeholder="bc1q..."
              value={formData.recipient}
              onChange={handleChange}
              required
            />

            <div className="grid md:grid-cols-2 gap-6">
              <Input
                label="Amount per Interval (BTC)"
                name="amountPerInterval"
                type="number"
                step="0.00000001"
                placeholder="0.001"
                value={formData.amountPerInterval}
                onChange={handleChange}
                required
              />

              <Select
                label="Interval"
                name="interval"
                value={formData.interval}
                onChange={handleChange}
                options={[
                  { value: "7 days", label: "Weekly" },
                  { value: "30 days", label: "Monthly" },
                  { value: "90 days", label: "Quarterly" },
                ]}
              />
            </div>

            <Input
              label="Total Lock Amount (BTC)"
              name="totalLocked"
              type="number"
              step="0.00000001"
              placeholder="0.01"
              value={formData.totalLocked}
              onChange={handleChange}
              required
            />

            <div className="pt-4">
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
                className="w-full"
              >
                {isSubmitting ? "Creating..." : "Create Charm Subscription"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

