import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Calendar, CheckCircle, Crown, Gift, Heart, Hotel, Mail, MapPin, Phone, Sparkles, Star, Users } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { useHotelTenant } from "../lib/hotelTenant";
import { useSupabaseAuth } from "../lib/supabase";

type OfferCategory = "accommodation" | "dining" | "spa" | "loyalty" | "seasonal";
type Offer = {
  id: string;
  title: string;
  description: string;
  discount: string;
  category: OfferCategory;
  starts_at?: string | null;
  ends_at?: string | null;
  minimum_nights?: number;
  featured?: boolean;
  terms?: string[];
  source: "booking" | "menu" | "loyalty" | "event";
  price?: number | string;
  original_price?: number | string | null;
  currency?: string;
  availability?: number | null;
  location?: string | null;
};
type OffersResponse = { tenant?: { name?: string }; offers?: Offer[]; error?: string };

const categories = [
  { id: "all", label: "All Offers", icon: Gift },
  { id: "dining", label: "Dining", icon: Users },
  { id: "accommodation", label: "Rooms", icon: Crown },
  { id: "spa", label: "Spa & Wellness", icon: Heart },
  { id: "loyalty", label: "Loyalty Rewards", icon: Star },
  { id: "seasonal", label: "Seasonal", icon: Sparkles },
] as const;

const iconFor = (category: OfferCategory) => ({
  accommodation: "🏨",
  dining: "🍽️",
  spa: "🧘",
  loyalty: "⭐",
  seasonal: "🎉",
})[category];

const linkFor = (offer: Offer) => ({
  accommodation: "/book",
  dining: "/menu",
  spa: "/spa",
  loyalty: "/profile?tab=rewards",
  seasonal: "/events",
})[offer.category];

const actionFor = (offer: Offer) => ({
  accommodation: "Book Now",
  dining: "View Menu",
  spa: "View Spa",
  loyalty: "Join Now",
  seasonal: "View Events",
})[offer.category];

const detailsFor = (offer: Offer, hotelName: string) => {
  if (offer.source === "booking") return "Automatically applied to eligible stays at checkout.";
  if (offer.source === "menu") return offer.availability === 0 ? "Currently unavailable" : "Available while this menu item is in stock.";
  if (offer.source === "loyalty") return `Earned through ${hotelName}'s active rewards program. Redemption is not currently available.`;
  return offer.location ? `Hosted at ${offer.location}.` : "See event details and availability.";
};

const HotelOffersPage = () => {
  const { loading: tenantLoading, error: tenantError } = useHotelTenant();
  const { session } = useSupabaseAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [hotelName, setHotelName] = useState("this hotel");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [copiedOffer, setCopiedOffer] = useState<string | null>(null);
  const [canManageOffers, setCanManageOffers] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (tenantLoading) return;
    if (tenantError) {
      setError(tenantError);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    void fetch("/api/hotel-offers", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as OffersResponse | null;
        if (!response.ok || !payload || !Array.isArray(payload.offers)) {
          throw new Error(payload?.error || "Offers could not be loaded.");
        }
        if (active) {
          setOffers(payload.offers);
          setHotelName(payload.tenant?.name || "this hotel");
        }
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Offers could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tenantLoading, tenantError, reloadKey]);

  useEffect(() => {
    if (tenantLoading || !session?.access_token) {
      setCanManageOffers(false);
      return;
    }
    let active = true;
    void fetch("/api/hotel-offers/manage/access", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" })
      .then((response) => { if (active) setCanManageOffers(response.ok); })
      .catch(() => { if (active) setCanManageOffers(false); });
    return () => { active = false; };
  }, [session?.access_token, tenantLoading]);

  const featuredOffer = offers.find((offer) => offer.featured);
  const visibleOffers = useMemo(() => offers.filter((offer) => selectedCategory === "all" || offer.category === selectedCategory), [offers, selectedCategory]);

  const copyOfferDetails = async (offer: Offer) => {
    const text = offer.source === "booking" ? "No code required — eligible stay discounts are applied at checkout." : `${offer.title}\n${offer.description}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedOffer(offer.id);
      window.setTimeout(() => setCopiedOffer(null), 2000);
    } catch {
      setError("Could not copy offer details. Please select and copy them manually.");
    }
  };

  const renderOffer = (offer: Offer) => {
    const validUntil = offer.ends_at ? new Date(offer.ends_at) : null;
    const expired = validUntil !== null && validUntil.getTime() <= currentTime;
    const startsAt = offer.starts_at ? new Date(offer.starts_at) : null;
    const isUpcoming = startsAt !== null && startsAt.getTime() > currentTime;
    const action = actionFor(offer);

    return (
      <Card key={`${offer.source}-${offer.id}`} className={`overflow-hidden transition-shadow hover:shadow-lg ${offer.featured ? "ring-2 ring-sheraton-gold" : ""} ${expired ? "opacity-60" : ""}`}>
        {offer.featured && <div className="bg-sheraton-gold py-1 text-center text-sm font-medium text-sheraton-navy">⭐ FEATURED OFFER ⭐</div>}
        <CardContent className="p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-4xl" aria-hidden="true">{iconFor(offer.category)}</span>
              <div>
                <h3 className="mb-1 font-bold text-sheraton-navy">{offer.title}</h3>
                <Badge className={offer.category === "accommodation" ? "bg-red-100 text-red-700" : offer.category === "loyalty" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}>{offer.discount}</Badge>
              </div>
            </div>
          </div>

          <p className="mb-4 text-sm text-gray-600">{offer.description}</p>

          <div className="mb-4 rounded-lg bg-gray-50 p-3">
            <div className="text-xs text-gray-500">How it works:</div>
            <div className="mt-1 font-medium text-sheraton-navy">{detailsFor(offer, hotelName)}</div>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => void copyOfferDetails(offer)}>
              {copiedOffer === offer.id ? <><CheckCircle className="mr-1 h-3 w-3" />Copied</> : "Copy offer details"}
            </Button>
          </div>

          <div className="mb-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><span className="text-gray-600">{offer.source === "event" ? "Starts:" : "Valid Until:"}</span><span className="font-medium">{startsAt && offer.source === "event" ? format(startsAt, "MMM d, yyyy") : validUntil ? format(validUntil, "MMM d, yyyy") : "Ongoing"}</span></div>
            {offer.minimum_nights ? <div className="flex justify-between gap-3"><span className="text-gray-600">Minimum stay:</span><span className="font-medium">{offer.minimum_nights} nights</span></div> : null}
            {offer.source === "menu" && offer.availability !== null && offer.availability !== undefined ? <div className="flex justify-between gap-3"><span className="text-gray-600">Availability:</span><span className="font-medium">{offer.availability > 0 ? `${offer.availability} available` : "Unavailable"}</span></div> : null}
            {offer.source === "event" && offer.location ? <div className="flex items-center justify-between gap-3"><span className="text-gray-600">Location:</span><span className="flex items-center gap-1 font-medium"><MapPin className="h-3 w-3" />{offer.location}</span></div> : null}
            {offer.source === "menu" && offer.price !== undefined ? <div className="flex justify-between gap-3"><span className="text-gray-600">Price:</span><span className="font-medium">{offer.currency || ""} {Number(offer.price).toLocaleString()}</span></div> : null}
          </div>

          {Boolean(offer.terms?.length) && <details className="mb-4 text-sm">
            <summary className="cursor-pointer text-gray-600 hover:text-sheraton-navy">Terms & Conditions</summary>
            <ul className="mt-2 space-y-1 text-xs text-gray-500">{offer.terms?.map((term, index) => <li key={index} className="flex items-start gap-1"><span>•</span><span>{term}</span></li>)}</ul>
          </details>}

          <Link to={linkFor(offer)} className="block">
            <Button className="w-full bg-sheraton-gold text-sheraton-navy hover:bg-sheraton-gold/90" disabled={expired || offer.availability === 0}>
              {offer.source === "event" && isUpcoming ? <><Calendar className="mr-2 h-4 w-4" />View upcoming events</> : action}
            </Button>
          </Link>
          {expired && <div className="mt-3 flex items-center gap-2 text-sm text-red-600"><AlertCircle className="h-4 w-4" />This offer has expired</div>}
        </CardContent>
      </Card>
    );
  };

  if (tenantLoading || loading) return <div className="min-h-screen bg-gradient-to-br from-sheraton-cream via-white to-sheraton-pearl"><div className="container mx-auto grid gap-6 px-4 py-12 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">{[0, 1, 2].map((item) => <div key={item} className="h-80 animate-pulse rounded-xl bg-muted" />)}</div></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-sheraton-cream via-white to-sheraton-pearl">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8 text-center">
          <div className="mb-4 flex items-center justify-center gap-3"><Crown className="h-10 w-10 text-sheraton-gold" /><h1 className="text-4xl font-bold text-sheraton-navy">Special Offers</h1></div>
          <p className="mx-auto max-w-2xl text-lg text-gray-600">Current offers and experiences available at {hotelName}.</p>
          {canManageOffers && <div className="mt-4"><Link to="/offers/manage"><Button variant="outline">Manage hotel offers</Button></Link></div>}
        </header>

        <Card className="mb-8 border-sheraton-gold bg-gradient-to-r from-sheraton-gold/20 to-sheraton-navy/20">
          <CardContent className="flex flex-col items-center justify-between gap-4 p-6 text-center md:flex-row md:text-left">
            <div className="flex items-center gap-4"><div className="text-6xl">{featuredOffer ? iconFor(featuredOffer.category) : "🎉"}</div><div><h2 className="mb-2 text-2xl font-bold text-sheraton-navy">{featuredOffer?.title || `Offers at ${hotelName}`}</h2><p className="text-gray-700">{featuredOffer?.description || `Offers published by ${hotelName} will appear here.`}</p></div></div>
            {featuredOffer && <Badge className="bg-sheraton-gold px-4 py-2 text-sheraton-navy">Featured</Badge>}
          </CardContent>
        </Card>

        <nav aria-label="Offer categories" className="mb-8 flex flex-wrap justify-center gap-2">
          {categories.map((category) => <Button key={category.id} variant={selectedCategory === category.id ? "default" : "outline"} onClick={() => setSelectedCategory(category.id)} className={`flex items-center gap-2 ${selectedCategory === category.id ? "bg-sheraton-gold text-sheraton-navy" : ""}`}><category.icon className="h-4 w-4" /><span>{category.label}</span></Button>)}
        </nav>

        {error && <Card className="mb-6 border-destructive/30"><CardContent className="flex flex-col items-center gap-3 p-6 text-center text-sm"><p role="alert">{error}</p><Button variant="outline" onClick={() => setReloadKey((value) => value + 1)}>Try again</Button></CardContent></Card>}

        <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visibleOffers.map(renderOffer)}
          {!loading && !error && visibleOffers.length === 0 && <div className="rounded-xl border border-dashed p-10 text-center text-gray-600 md:col-span-2 lg:col-span-3">No current offers in this category.</div>}
        </div>

        {offers.some((offer) => offer.source === "loyalty") && <Card className="bg-sheraton-navy text-white">
          <CardContent className="p-8 text-center">
            <div className="mb-4 flex items-center justify-center gap-2"><Gift className="h-6 w-6 text-sheraton-gold" /><h2 className="text-2xl font-bold">Make the Most of Your Stay</h2></div>
            <p className="mx-auto mb-6 max-w-2xl text-white/80">Join {hotelName}'s rewards program to earn points on eligible purchases. Points are promotional rewards and cannot currently be redeemed.</p>
            <Link to="/profile?tab=rewards"><Button className="bg-sheraton-gold text-sheraton-navy hover:bg-sheraton-gold/90">Explore Rewards</Button></Link>
          </CardContent>
        </Card>}

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <Card><CardContent className="p-6 text-center"><Phone className="mx-auto mb-3 h-8 w-8 text-sheraton-gold" /><h3 className="mb-2 font-semibold text-sheraton-navy">Reservations</h3><p className="mb-3 text-sm text-gray-600">Browse available rooms and eligible stay discounts.</p><Link to="/book"><Button variant="outline" size="sm">View Rooms</Button></Link></CardContent></Card>
          <Card><CardContent className="p-6 text-center"><Mail className="mx-auto mb-3 h-8 w-8 text-sheraton-gold" /><h3 className="mb-2 font-semibold text-sheraton-navy">Personal Assistance</h3><p className="mb-3 text-sm text-gray-600">Contact the hotel concierge for help with your visit.</p><Link to="/concierge"><Button variant="outline" size="sm">Contact Concierge</Button></Link></CardContent></Card>
          <Card><CardContent className="p-6 text-center"><Hotel className="mx-auto mb-3 h-8 w-8 text-sheraton-gold" /><h3 className="mb-2 font-semibold text-sheraton-navy">Dining & Experiences</h3><p className="mb-3 text-sm text-gray-600">See current menu specials and upcoming hotel events.</p><div className="flex justify-center gap-2"><Link to="/menu"><Button variant="outline" size="sm">View Menu</Button></Link><Link to="/events"><Button variant="outline" size="sm">View Events</Button></Link></div></CardContent></Card>
        </div>
      </div>
    </div>
  );
};

export default HotelOffersPage;
