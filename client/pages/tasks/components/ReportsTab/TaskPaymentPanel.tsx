import React, { useEffect, useState } from "react";
import { supabase, Task as TaskType, WorkerTaskPayment } from "../../../../lib/supabase";
import { toast } from "../../../../hooks/use-toast";

const PAYMENT_METHODS: Array<{ value: WorkerTaskPayment["payment_method"]; label: string }> = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "mobile_money", label: "Mobile money" },
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

interface TaskPaymentPanelProps {
  task: TaskType;
}

const TaskPaymentPanel: React.FC<TaskPaymentPanelProps> = ({ task }) => {
  const [payment, setPayment] = useState<WorkerTaskPayment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [method, setMethod] = useState<WorkerTaskPayment["payment_method"]>("bank_transfer");
  const [reference, setReference] = useState("");
  const [vatInput, setVatInput] = useState("");

  const agreedAmount = task.final_amount ?? 0;
  const hasAgreedAmount = agreedAmount > 0;
  const vatAmount = vatInput.trim() === "" ? 0 : Number(vatInput);
  const isVatValid = Number.isFinite(vatAmount) && vatAmount >= 0 && vatAmount < agreedAmount;

  const loadPayment = async () => {
    const { data, error } = await supabase
      .from("worker_task_payments")
      .select("amount, tax_amount, currency_code, payment_method, payment_reference, paid_at")
      .eq("task_id", task.id)
      .maybeSingle();
    if (error) {
      toast({ title: "Could not load payment", description: error.message, variant: "destructive" });
    }
    setPayment(data ?? null);
    setIsLoading(false);
  };

  useEffect(() => {
    setIsLoading(true);
    void loadPayment();
  }, [task.id]);

  const handleRecordPayment = async () => {
    const trimmedReference = reference.trim();
    if (!trimmedReference) {
      toast({ title: "Reference required", description: "Enter the payment reference before recording.", variant: "destructive" });
      return;
    }
    if (!isVatValid) {
      toast({ title: "Invalid VAT", description: "VAT must be zero or less than the agreed amount.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    const { error } = await supabase.rpc("record_worker_task_payment", {
      p_task_id: task.id,
      p_payment_method: method,
      p_payment_reference: trimmedReference,
      p_tax_amount: vatAmount,
    });
    setIsSaving(false);
    if (error) {
      toast({ title: "Payment not recorded", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Payment recorded", description: "Posted to the hotel and worker Books." });
    setReference("");
    setVatInput("");
    void loadPayment();
  };

  if (isLoading) return null;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border-2 border-sheraton-gold">
      <h3 className="text-lg font-semibold text-sheraton-navy mb-4">Worker Payment</h3>
      <div className="mb-4 text-sm">
        <p className="text-gray-600">Agreed amount</p>
        <p className="font-medium text-gray-900">
          {hasAgreedAmount ? agreedAmount.toLocaleString() : "No agreed amount on this task"}
        </p>
      </div>

      {payment ? (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 space-y-1">
          <p className="font-semibold">
            Paid {payment.amount.toLocaleString()} {payment.currency_code} on {new Date(payment.paid_at).toLocaleDateString()}
          </p>
          {payment.tax_amount > 0 && (
            <p>VAT included: {payment.tax_amount.toLocaleString()} {payment.currency_code}</p>
          )}
          <p>Method: {PAYMENT_METHODS.find((item) => item.value === payment.payment_method)?.label ?? payment.payment_method}</p>
          <p>Reference: {payment.payment_reference}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label htmlFor="worker-payment-method" className="block text-sm font-medium text-gray-700 mb-1">
              Payment method
            </label>
            <select
              id="worker-payment-method"
              value={method}
              onChange={(event) => setMethod(event.target.value as WorkerTaskPayment["payment_method"])}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              {PAYMENT_METHODS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="worker-payment-vat" className="block text-sm font-medium text-gray-700 mb-1">
              VAT included in agreed amount (optional)
            </label>
            <input
              id="worker-payment-vat"
              type="number"
              min="0"
              step="any"
              value={vatInput}
              onChange={(event) => setVatInput(event.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label htmlFor="worker-payment-reference" className="block text-sm font-medium text-gray-700 mb-1">
              Payment reference
            </label>
            <input
              id="worker-payment-reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              maxLength={120}
              placeholder="Transfer ID or receipt number"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          <button
            type="button"
            onClick={() => void handleRecordPayment()}
            disabled={!hasAgreedAmount || isSaving || !reference.trim() || !isVatValid}
            className="px-4 py-2 bg-sheraton-gold text-sheraton-navy rounded-lg font-semibold disabled:opacity-50"
          >
            {isSaving ? "Recording..." : "Record payment"}
          </button>
        </div>
      )}
    </div>
  );
};

export default TaskPaymentPanel;
