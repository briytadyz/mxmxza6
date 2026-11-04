import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { useSupabaseAuth } from "../lib/supabase";
import { useHotelTenant } from "../lib/hotelTenant";

type Offer = {
  id: string;
  title: string;
  description: string;
  discount_percentage: number;
  minimum_nights: number;
  starts_at: string | null;
  ends_at: string | null;
  display_order: number;
  featured: boolean;
  terms: string[];
  is_active: boolean;
};

type OfferForm = Omit<Offer, "id">;
const emptyForm: OfferForm = {
  title: "",
  description: "",
  discount_percentage: 0,
  minimum_nights: 1,
  starts_at: null,
  ends_at: null,
  display_order: 0,
  featured: false,
  terms: [],
  is_active: false,
};
const localDateTime = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const HotelOffersManagementPage = () => {
  const { session } = useSupabaseAuth();
  const { loading: tenantLoading, error: tenantError } = useHotelTenant();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [form, setForm] = useState<OfferForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadOffers = useCallback(async () => {
    if (!session?.access_token) {
      setLoading(false);
      setError("Sign in with a hotel manager account to manage offers.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/hotel-offers/manage", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
      const payload = await response.json().catch(() => null) as { offers?: Offer[]; error?: string } | null;
      if (!response.ok || !payload || !Array.isArray(payload.offers)) throw new Error(payload?.error || "Offers could not be loaded.");
      setOffers(payload.offers);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Offers could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (tenantLoading) return;
    if (tenantError) {
      setLoading(false);
      setError(tenantError);
      return;
    }
    void loadOffers();
  }, [tenantLoading, tenantError, loadOffers]);

  const startEditing = (offer: Offer) => {
    setEditingId(offer.id);
    setForm({ ...offer, starts_at: localDateTime(offer.starts_at), ends_at: localDateTime(offer.ends_at) });
    setNotice(null);
  };

  const saveOffer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session?.access_token) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    const payload = {
      ...(editingId ? { id: editingId } : {}),
      ...form,
      discount_percentage: Number(form.discount_percentage),
      minimum_nights: Number(form.minimum_nights),
      display_order: Number(form.display_order),
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      terms: Array.isArray(form.terms) ? form.terms : [],
    };
    try {
      const response = await fetch("/api/hotel-offers/manage", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || "Offer could not be saved.");
      setNotice(editingId ? "Offer updated." : "Offer created.");
      setEditingId(null);
      setForm(emptyForm);
      await loadOffers();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Offer could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const updateForm = <K extends keyof OfferForm>(key: K, value: OfferForm[K]) => setForm((current) => ({ ...current, [key]: value }));

  if (tenantLoading || loading) return <main className="container mx-auto min-h-screen px-4 py-12" aria-busy="true"><div className="h-72 animate-pulse rounded-xl bg-muted" /></main>;

  return (
    <main className="container mx-auto min-h-screen max-w-5xl px-4 py-8">
      <Link to="/offers" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to offers</Link>
      <header className="mb-8"><h1 className="text-3xl font-bold text-sheraton-navy">Hotel stay offers</h1><p className="mt-2 text-muted-foreground">Manage the automatic stay discounts shown to guests and applied by booking checkout.</p></header>
      {tenantError && <p className="mb-4 rounded-md border border-destructive/30 p-4 text-sm" role="alert">{tenantError}</p>}
      {error && <p className="mb-4 rounded-md border border-destructive/30 p-4 text-sm" role="alert">{error}</p>}
      {notice && <p className="mb-4 rounded-md border border-green-300 bg-green-50 p-4 text-sm text-green-900" role="status">{notice}</p>}

      <Card className="mb-8">
        <CardHeader><CardTitle>{editingId ? "Edit stay offer" : "Create stay offer"}</CardTitle><p className="text-sm text-muted-foreground">These percentage offers are automatically applied to eligible bookings; promo codes and stacking are not supported.</p></CardHeader>
        <CardContent>
          <form onSubmit={(event) => void saveOffer(event)} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="offer-title">Title</Label><Input id="offer-title" value={form.title} onChange={(event) => updateForm("title", event.target.value)} maxLength={120} required /></div>
            <div className="space-y-2"><Label htmlFor="offer-order">Display order</Label><Input id="offer-order" type="number" min="0" step="1" value={form.display_order} onChange={(event) => updateForm("display_order", Number(event.target.value))} required /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="offer-description">Description</Label><Textarea id="offer-description" value={form.description} onChange={(event) => updateForm("description", event.target.value)} rows={3} maxLength={2000} required /></div>
            <div className="space-y-2"><Label htmlFor="offer-discount">Discount percentage</Label><Input id="offer-discount" type="number" min="0" max="100" step="0.01" value={form.discount_percentage} onChange={(event) => updateForm("discount_percentage", Number(event.target.value))} required /></div>
            <div className="space-y-2"><Label htmlFor="offer-minimum">Minimum nights</Label><Input id="offer-minimum" type="number" min="1" step="1" value={form.minimum_nights} onChange={(event) => updateForm("minimum_nights", Number(event.target.value))} required /></div>
            <div className="space-y-2"><Label htmlFor="offer-start">Starts at</Label><Input id="offer-start" type="datetime-local" value={form.starts_at || ""} onChange={(event) => updateForm("starts_at", event.target.value || null)} /></div>
            <div className="space-y-2"><Label htmlFor="offer-end">Ends at</Label><Input id="offer-end" type="datetime-local" value={form.ends_at || ""} onChange={(event) => updateForm("ends_at", event.target.value || null)} /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="offer-terms">Terms (one per line)</Label><Textarea id="offer-terms" value={form.terms.join("\n")} onChange={(event) => updateForm("terms", event.target.value.split("\n").slice(0, 12))} rows={4} maxLength={3600} /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.featured} onChange={(event) => updateForm("featured", event.target.checked)} />Featured offer</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(event) => updateForm("is_active", event.target.checked)} />Published</label>
            <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : <><Plus className="mr-2 h-4 w-4" />Create offer</>}</Button>{editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancel</Button>}</div>
          </form>
        </CardContent>
      </Card>

      <section aria-labelledby="managed-offers-heading"><h2 id="managed-offers-heading" className="mb-3 text-xl font-semibold">All stay offers</h2>{offers.length ? <div className="space-y-3">{offers.map((offer) => <Card key={offer.id}><CardContent className="flex flex-wrap items-center justify-between gap-4 p-4"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{offer.title}</h3><span className="rounded-full border px-2 py-0.5 text-xs">{offer.is_active ? "Published" : "Draft / inactive"}</span>{offer.featured && <span className="rounded-full bg-sheraton-gold/20 px-2 py-0.5 text-xs">Featured</span>}</div><p className="mt-1 text-sm text-muted-foreground">{offer.discount_percentage}% off · {offer.minimum_nights} night minimum · {offer.starts_at ? new Date(offer.starts_at).toLocaleDateString() : "No start date"} to {offer.ends_at ? new Date(offer.ends_at).toLocaleDateString() : "No end date"}</p></div><Button variant="outline" size="sm" onClick={() => startEditing(offer)}>Edit</Button></CardContent></Card>)}</div> : <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No stay offers have been created for this property.</p>}</section>
    </main>
  );
};

export default HotelOffersManagementPage;
