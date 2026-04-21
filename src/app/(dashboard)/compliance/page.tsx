"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { RoleGuard } from "@/components/shared/RoleGuard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Upload, AlertTriangle, CheckCircle, Clock, Search } from "lucide-react";
import { formatDate, daysUntilExpiry } from "@/lib/utils/date";
import type { ComplianceDocStatus } from "@prisma/client";

const STATUS_CONFIG: Record<ComplianceDocStatus, { label: string; icon: React.ReactNode; badgeClass: string }> = {
  VALID: { label: "Valid", icon: <CheckCircle className="h-3.5 w-3.5" />, badgeClass: "bg-green-100 text-green-700" },
  EXPIRING_SOON: { label: "Expiring Soon", icon: <Clock className="h-3.5 w-3.5" />, badgeClass: "bg-amber-100 text-amber-700" },
  EXPIRED: { label: "Expired", icon: <AlertTriangle className="h-3.5 w-3.5" />, badgeClass: "bg-red-100 text-red-700" },
  PENDING: { label: "Pending Upload", icon: <Upload className="h-3.5 w-3.5" />, badgeClass: "bg-slate-100 text-slate-600" },
};

export default function CompliancePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["compliance", { clientId }],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "100", ...(clientId ? { clientId } : {}) });
      const res = await fetch(`/api/compliance?${params}`);
      const json = await res.json();
      return json.data;
    },
  });

  const { data: clientsData } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      // We'll call the projects endpoint to get unique clients
      const res = await fetch("/api/pos?limit=100");
      const json = await res.json();
      const pos = json.data?.items ?? [];
      const map = new Map<string, { id: string; name: string }>();
      for (const po of pos) {
        map.set(po.client.id, { id: po.client.id, name: po.client.name });
      }
      return Array.from(map.values());
    },
  });

  const { data: docTypesData } = useQuery({
    queryKey: ["compliance-doc-types"],
    queryFn: async () => {
      // Fetch from a simple compliance endpoint
      return [];
    },
  });

  const [uploadForm, setUploadForm] = useState({
    clientId: "",
    docTypeId: "",
    validFrom: "",
    expiryDate: "",
    notes: "",
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error("Please select a file");

      const formData = new FormData();
      formData.append("file", file);
      Object.entries(uploadForm).forEach(([k, v]) => formData.append(k, v));

      const res = await fetch("/api/compliance", { method: "POST", body: formData });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      toast({ title: "Document uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: ["compliance"] });
      setUploadOpen(false);
      setUploadForm({ clientId: "", docTypeId: "", validFrom: "", expiryDate: "", notes: "" });
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const docs = (data?.items ?? []).filter((d: { docType: { name: string }; client: { name: string } }) =>
    !search ||
    d.docType.name.toLowerCase().includes(search.toLowerCase()) ||
    d.client.name.toLowerCase().includes(search.toLowerCase())
  );

  // Group by client
  const byClient = docs.reduce((acc: Record<string, { clientName: string; docs: unknown[] }>, doc: { client: { id: string; name: string } }) => {
    const key = doc.client.id;
    if (!acc[key]) acc[key] = { clientName: doc.client.name, docs: [] };
    acc[key].docs.push(doc);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Compliance</h1>
          <p className="text-sm text-muted-foreground">Statutory documents and validity tracking</p>
        </div>
        <RoleGuard permission="compliance:upload">
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button className="bg-brand-500 hover:bg-brand-600">
                <Upload className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Compliance Document</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label>Client</Label>
                  <Select value={uploadForm.clientId} onValueChange={(v) => setUploadForm((f) => ({ ...f, clientId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>
                      {(clientsData ?? []).map((c: { id: string; name: string }) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valid From</Label>
                  <Input
                    type="date"
                    value={uploadForm.validFrom}
                    onChange={(e) => setUploadForm((f) => ({ ...f, validFrom: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Expiry Date</Label>
                  <Input
                    type="date"
                    value={uploadForm.expiryDate}
                    onChange={(e) => setUploadForm((f) => ({ ...f, expiryDate: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Notes (optional)</Label>
                  <Input
                    value={uploadForm.notes}
                    onChange={(e) => setUploadForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Any additional notes"
                  />
                </div>
                <div>
                  <Label>File</Label>
                  <Input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx" />
                </div>
                <Button
                  className="w-full bg-brand-500 hover:bg-brand-600"
                  onClick={() => uploadMutation.mutate()}
                  disabled={uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? "Uploading..." : "Upload"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </RoleGuard>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search documents or clients..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-40 rounded-xl" />)}
        </div>
      ) : Object.keys(byClient).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">No compliance documents found</p>
          <p className="text-sm mt-1">Upload documents to track compliance across clients</p>
        </div>
      ) : (
        Object.values(byClient).map((group: { clientName: string; docs: unknown[] }) => (
          <Card key={group.clientName}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                {group.clientName}
                <span className="text-xs font-normal text-muted-foreground">{group.docs.length} document(s)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(group.docs as { id: string; docType: { name: string }; validFrom: string; expiryDate: string; status: ComplianceDocStatus; fileUrl: string }[]).map((doc) => {
                  const config = STATUS_CONFIG[doc.status];
                  const days = daysUntilExpiry(doc.expiryDate);
                  return (
                    <div key={doc.id} className="flex items-center justify-between py-2 border-b last:border-0 gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.docType.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Valid: {formatDate(doc.validFrom)} → {formatDate(doc.expiryDate)}
                          {days > 0 && ` (${days}d left)`}
                          {days <= 0 && ` (expired ${Math.abs(days)}d ago)`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={`${config.badgeClass} flex items-center gap-1`}>
                          {config.icon}
                          {config.label}
                        </Badge>
                        <a
                          href={`/api/upload?path=${encodeURIComponent(doc.fileUrl)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-brand-500 hover:underline"
                        >
                          View
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
