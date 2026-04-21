"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Plus, Upload, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { formatINR } from "@/lib/utils/currency";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

const expenseSchema = z.object({
  category: z.enum(["TRAVEL", "ACCOMMODATION", "FOOD", "MATERIALS", "TOOLS", "COMMUNICATION", "OTHER"]),
  amount: z.coerce.number().positive("Amount must be positive"),
  description: z.string().min(3, "Description required"),
  billDate: z.string().min(1, "Bill date required"),
  notes: z.string().optional(),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string;
  status: string;
  billDate: string;
  submittedAt: string;
  receipt?: string;
  notes?: string;
  submittedBy: { name: string };
  reviewedBy?: { name: string };
  reviewNote?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  TRAVEL: "Travel",
  ACCOMMODATION: "Accommodation",
  FOOD: "Food & Meals",
  MATERIALS: "Materials",
  TOOLS: "Tools & Equipment",
  COMMUNICATION: "Communication",
  OTHER: "Other",
};

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "muted"> = {
  APPROVED: "success",
  PENDING_APPROVAL: "warning",
  REJECTED: "destructive",
};

export default function ExpensesPage() {
  const { id } = useParams<{ id: string }>();
  const { can, user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [filter, setFilter] = useState<string>("ALL");

  const { data: expenses, isLoading } = useQuery<Expense[]>({
    queryKey: ["expenses", id],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${id}/expenses`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { register, handleSubmit, formState: { errors }, reset } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { category: "TRAVEL" },
  });

  const submitExpense = useMutation({
    mutationFn: async (data: ExpenseForm) => {
      let receiptUrl: string | undefined;

      // Upload receipt first if present
      if (receiptFile) {
        const fd = new FormData();
        fd.append("file", receiptFile);
        fd.append("subfolder", "receipts");
        const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
        if (uploadRes.ok) {
          const uploaded = await uploadRes.json();
          receiptUrl = uploaded.url;
        }
      }

      const res = await fetch(`/api/projects/${id}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, receipt: receiptUrl }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", id] });
      toast({ title: "Expense submitted", description: "Awaiting PM approval" });
      reset();
      setReceiptFile(null);
      setDialogOpen(false);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const reviewExpense = useMutation({
    mutationFn: async ({ expenseId, action, reviewNote }: { expenseId: string; action: "approve" | "reject"; reviewNote?: string }) => {
      const res = await fetch(`/api/projects/${id}/expenses/${expenseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reviewNote }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses", id] });
      toast({ title: "Expense reviewed" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filtered = expenses?.filter((e) => filter === "ALL" || e.status === filter) ?? [];
  const totalApproved = expenses?.filter(e => e.status === "APPROVED").reduce((s, e) => s + e.amount, 0) ?? 0;
  const totalPending = expenses?.filter(e => e.status === "PENDING_APPROVAL").reduce((s, e) => s + e.amount, 0) ?? 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/projects/${id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Expenses</h1>
            <p className="text-sm text-muted-foreground">Project expense claims</p>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="brand" size="sm">
              <Plus className="h-4 w-4" />
              Add Expense
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Submit Expense</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit((d) => submitExpense.mutate(d))} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <select
                    className="flex h-9 w-full appearance-none rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    {...register("category")}
                  >
                    {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Amount (₹)</Label>
                  <Input type="number" step="0.01" placeholder="0.00" {...register("amount")} />
                  {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Description</Label>
                <Input placeholder="Brief description of expense" {...register("description")} />
                {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Bill Date</Label>
                <Input type="date" {...register("billDate")} />
                {errors.billDate && <p className="text-xs text-destructive">{errors.billDate.message}</p>}
              </div>

              <div className="space-y-1.5">
                <Label>Receipt (optional)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                    className="cursor-pointer"
                  />
                </div>
                {receiptFile && (
                  <p className="text-xs text-muted-foreground">{receiptFile.name}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea rows={2} placeholder="Optional notes…" {...register("notes")} />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button type="submit" variant="brand" loading={submitExpense.isPending}>Submit</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Approved</p>
            <p className="text-lg font-bold text-green-600">{formatINR(totalApproved)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Pending Approval</p>
            <p className="text-lg font-bold text-amber-600">{formatINR(totalPending)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {["ALL", "PENDING_APPROVAL", "APPROVED", "REJECTED"].map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f === "ALL" ? "All" : f.replace(/_/g, " ")}
          </Button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((n) => <Skeleton key={n} className="h-20 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">No expenses in this category</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((exp) => (
            <Card key={exp.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{exp.description}</p>
                      <Badge variant={STATUS_VARIANT[exp.status] ?? "muted"} className="text-xs">
                        {exp.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {CATEGORY_LABELS[exp.category]} · {format(new Date(exp.billDate), "dd MMM yyyy")} · By {exp.submittedBy.name}
                    </p>
                    {exp.reviewedBy && (
                      <p className="text-xs text-muted-foreground">
                        Reviewed by {exp.reviewedBy.name}
                        {exp.reviewNote ? ` — "${exp.reviewNote}"` : ""}
                      </p>
                    )}
                    {exp.receipt && (
                      <a
                        href={exp.receipt}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary underline mt-1 inline-block"
                      >
                        View Receipt
                      </a>
                    )}
                  </div>

                  <div className="text-right flex flex-col items-end gap-2">
                    <p className="font-bold">{formatINR(exp.amount)}</p>
                    {can("expense:approve") && exp.status === "PENDING_APPROVAL" && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-green-600 border-green-200 hover:bg-green-50"
                          onClick={() => reviewExpense.mutate({ expenseId: exp.id, action: "approve" })}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => reviewExpense.mutate({ expenseId: exp.id, action: "reject" })}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
