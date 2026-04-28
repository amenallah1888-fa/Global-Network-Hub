export type User = {
  id: string;
  name: string;
  handle: string;
  title: string;
  company: string;
  avatar: any;
  verified?: boolean;
  followers: number;
  following: boolean;
  city: string;
  country: string;
};

export type Post = {
  id: string;
  authorId: string;
  createdAt: string;
  text: string;
  image?: any;
  likes: number;
  retweets: number;
  comments: number;
  tips: number;
  liked: boolean;
  retweeted: boolean;
  sponsored?: boolean;
  sponsorLabel?: string;
};

export type Circle = {
  id: string;
  name: string;
  about: string;
  members: number;
  paid: boolean;
  price?: number;
  category: string;
  color: string;
  cover?: any;
  active: number;
  founderIds: string[];
  joined: boolean;
};

export type Pitch = {
  id: string;
  title: string;
  founderId: string;
  stage: "Idea" | "Pre-seed" | "Seed" | "Series A" | "Series B";
  industry: string;
  raising: number;
  raised: number;
  city: string;
  summary: string;
  cover?: any;
  backers: number;
  trending?: boolean;
};

export type MapMarker = {
  id: string;
  type: "person" | "business" | "project";
  label: string;
  city: string;
  // Normalized coordinates 0..1 across the map background
  x: number;
  y: number;
  meta: string;
};

const avatar1 = require("../assets/images/avatar1.png");
const avatar2 = require("../assets/images/avatar2.png");
const avatar3 = require("../assets/images/avatar3.png");
const post1 = require("../assets/images/post1.png");
const post2 = require("../assets/images/post2.png");

export const currentUser: User = {
  id: "u_me",
  name: "Alex Rivera",
  handle: "alexrivera",
  title: "Founder & CEO",
  company: "Helix Labs",
  avatar: avatar1,
  verified: true,
  followers: 12480,
  following: false,
  city: "San Francisco",
  country: "USA",
};

export const users: User[] = [
  currentUser,
  {
    id: "u_amelia",
    name: "Amelia Chen",
    handle: "ameliac",
    title: "Partner",
    company: "North Bay Ventures",
    avatar: avatar2,
    verified: true,
    followers: 38210,
    following: true,
    city: "New York",
    country: "USA",
  },
  {
    id: "u_marcus",
    name: "Marcus Vale",
    handle: "marcusv",
    title: "Designer in Residence",
    company: "Atelier Nord",
    avatar: avatar3,
    verified: false,
    followers: 4870,
    following: false,
    city: "Berlin",
    country: "Germany",
  },
  {
    id: "u_priya",
    name: "Priya Anand",
    handle: "priya",
    title: "Head of Growth",
    company: "Ledger Cloud",
    avatar: avatar1,
    verified: true,
    followers: 9210,
    following: true,
    city: "Bengaluru",
    country: "India",
  },
  {
    id: "u_jonas",
    name: "Jonas Holm",
    handle: "jonash",
    title: "Engineer",
    company: "Polaris Robotics",
    avatar: avatar2,
    verified: false,
    followers: 1390,
    following: false,
    city: "Stockholm",
    country: "Sweden",
  },
];

export const posts: Post[] = [
  {
    id: "p1",
    authorId: "u_amelia",
    createdAt: "2h",
    text: "We just closed our $42M Series B for vertical AI in commercial real estate. Looking to back two more pre-seed teams this quarter — operators only, no decks under 5 slides.",
    likes: 1284,
    retweets: 312,
    comments: 87,
    tips: 41,
    liked: false,
    retweeted: false,
  },
  {
    id: "p2",
    authorId: "u_marcus",
    createdAt: "5h",
    text: "Studio update: the prototype shipped to manufacturing this morning. Every curve was hand-tuned in three weeks of late nights. Sometimes the brief is the easy part.",
    image: post1,
    likes: 642,
    retweets: 71,
    comments: 38,
    tips: 12,
    liked: true,
    retweeted: false,
  },
  {
    id: "p_sponsored",
    authorId: "u_priya",
    createdAt: "Sponsored",
    text: "Ledger Cloud — the audit-ready ledger for Series A and beyond. Replace QuickBooks in a weekend. First 90 days free for Nexus founders.",
    image: post2,
    likes: 211,
    retweets: 18,
    comments: 9,
    tips: 0,
    liked: false,
    retweeted: false,
    sponsored: true,
    sponsorLabel: "Promoted by Ledger Cloud",
  },
  {
    id: "p3",
    authorId: "u_jonas",
    createdAt: "8h",
    text: "Hot take: most hardware startups don't have a hardware problem. They have a story problem. The robot is fine. The narrative is mush.",
    likes: 388,
    retweets: 92,
    comments: 54,
    tips: 7,
    liked: false,
    retweeted: true,
  },
  {
    id: "p4",
    authorId: "u_priya",
    createdAt: "1d",
    text: "Hiring two senior PMs in Bengaluru and one staff PM in remote Europe. DM if you've shipped infra to >10k devs. Salary band on profile.",
    likes: 502,
    retweets: 144,
    comments: 28,
    tips: 3,
    liked: true,
    retweeted: false,
  },
];

export const circles: Circle[] = [
  {
    id: "c1",
    name: "Founders Roundtable",
    about: "Closed-door operator chats: hiring, fundraising, hard calls.",
    members: 1284,
    active: 47,
    paid: true,
    price: 49,
    category: "Operators",
    color: "#D4AF7A",
    cover: post1,
    founderIds: ["u_amelia", "u_priya"],
    joined: true,
  },
  {
    id: "c2",
    name: "Climate Capital",
    about: "Investors and founders building the energy transition.",
    members: 612,
    active: 22,
    paid: false,
    category: "Climate",
    color: "#48BB78",
    cover: post2,
    founderIds: ["u_amelia"],
    joined: false,
  },
  {
    id: "c3",
    name: "Design Engineers",
    about: "Where craft meets product. Critique nights every Thursday.",
    members: 2104,
    active: 88,
    paid: false,
    category: "Craft",
    color: "#6FA8DC",
    founderIds: ["u_marcus"],
    joined: true,
  },
  {
    id: "c4",
    name: "Family Office Briefing",
    about: "Curated deal flow for single-family offices. Application required.",
    members: 184,
    active: 12,
    paid: true,
    price: 199,
    category: "Capital",
    color: "#9D7BFF",
    founderIds: ["u_amelia"],
    joined: false,
  },
  {
    id: "c5",
    name: "AI in Healthcare",
    about: "Clinicians, researchers, and founders shipping FDA-grade AI.",
    members: 942,
    active: 31,
    paid: false,
    category: "Health",
    color: "#E5484D",
    founderIds: ["u_priya", "u_jonas"],
    joined: false,
  },
];

export const pitches: Pitch[] = [
  {
    id: "pi1",
    title: "Helix — autonomous lab for synthetic biology",
    founderId: "u_me",
    stage: "Seed",
    industry: "BioTech",
    raising: 4_000_000,
    raised: 2_650_000,
    city: "San Francisco",
    summary:
      "End-to-end robotic wet lab that runs experiments 24/7. We've cut iteration time from weeks to hours for three pilot customers.",
    cover: post1,
    backers: 14,
    trending: true,
  },
  {
    id: "pi2",
    title: "Polaris — ruggedized warehouse robotics",
    founderId: "u_jonas",
    stage: "Series A",
    industry: "Robotics",
    raising: 18_000_000,
    raised: 11_400_000,
    city: "Stockholm",
    summary:
      "Forklift-scale robots that retrofit existing warehouses in 48 hours. $4.2M ARR, 90% gross margin.",
    cover: post2,
    backers: 9,
  },
  {
    id: "pi3",
    title: "Atelier Nord — bespoke furniture marketplace",
    founderId: "u_marcus",
    stage: "Pre-seed",
    industry: "Commerce",
    raising: 800_000,
    raised: 320_000,
    city: "Berlin",
    summary:
      "Heirloom-grade pieces from 40 European workshops. Built a waitlist of 2,200 collectors before launch.",
    backers: 6,
    trending: true,
  },
  {
    id: "pi4",
    title: "Ledger Cloud — modern accounting ledger",
    founderId: "u_priya",
    stage: "Series B",
    industry: "FinTech",
    raising: 30_000_000,
    raised: 30_000_000,
    city: "Bengaluru",
    summary:
      "Audit-ready ledger replacing legacy ERPs. 4,800 customers, 142% NRR.",
    backers: 22,
  },
];

export const mapMarkers: MapMarker[] = [
  { id: "m1", type: "person", label: "Amelia Chen", city: "New York", x: 0.27, y: 0.34, meta: "Partner · NBV" },
  { id: "m2", type: "business", label: "Helix Labs", city: "San Francisco", x: 0.16, y: 0.36, meta: "BioTech · Hiring" },
  { id: "m3", type: "project", label: "Polaris", city: "Stockholm", x: 0.52, y: 0.22, meta: "Series A · Trending" },
  { id: "m4", type: "person", label: "Marcus Vale", city: "Berlin", x: 0.51, y: 0.28, meta: "Designer in Residence" },
  { id: "m5", type: "business", label: "Atelier Nord", city: "Berlin", x: 0.515, y: 0.295, meta: "Commerce · 2.2k waitlist" },
  { id: "m6", type: "person", label: "Priya Anand", city: "Bengaluru", x: 0.69, y: 0.49, meta: "Head of Growth" },
  { id: "m7", type: "project", label: "Ledger Cloud", city: "Bengaluru", x: 0.695, y: 0.5, meta: "Series B · Live" },
  { id: "m8", type: "business", label: "Sightglass Roasters", city: "São Paulo", x: 0.34, y: 0.66, meta: "F&B · Sponsor" },
  { id: "m9", type: "person", label: "Yuki Tanaka", city: "Tokyo", x: 0.84, y: 0.4, meta: "Robotics PM" },
  { id: "m10", type: "project", label: "Reef OS", city: "Sydney", x: 0.88, y: 0.74, meta: "Climate · Pre-seed" },
  { id: "m11", type: "business", label: "Lagos Studio", city: "Lagos", x: 0.5, y: 0.55, meta: "Creative · Hiring" },
  { id: "m12", type: "person", label: "Sara Bennani", city: "Casablanca", x: 0.46, y: 0.42, meta: "Investor" },
];

export function getUser(id: string): User {
  return users.find((u) => u.id === id) ?? currentUser;
}
