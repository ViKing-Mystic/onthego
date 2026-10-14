/**
 * OntheGO - TypeScript Type Definitions & Data Model Contracts
 * Defines the core domain entities for the 2-traveller companion application:
 * Itinerary, Bookings, Shared Expenses, Travellers, Memories, and AI Assistant.
 */

export type ActivityCategory =
  | "Sightseeing"
  | "Restaurant"
  | "Beach"
  | "Activity"
  | "Transport"
  | "Accommodation"
  | "Temple"
  | "Museum"
  | "Rest";

export type ActivityStatus = "pending" | "completed" | "skipped";

export interface Activity {
  id: string;
  order: number;
  time: string;
  title: string;
  category: ActivityCategory;
  isFixedCommitment?: boolean;
  priority?: "High" | "Medium" | "Low";
  location?: string;
  lat?: number;
  lng?: number;
  durationMins?: number;
  cost?: number;
  bookingStatus?: string;
  bookingRef?: string;
  phone?: string;
  mapUrl?: string;
  verified?: boolean;
  verificationSource?: string;
  verifiedDate?: string;
  notes?: string;
  scheduleConflict?: string;
  status: ActivityStatus;
}

export interface DayPlan {
  id: string;
  dayNumber: number;
  dateHuman: string;
  isoDate: string;
  theme: string;
  route: string;
  distanceKm: number;
  estimatedRideTime: string;
  nightStayId?: string;
  nightStayName?: string;
  nightStayPhone?: string;
  warning?: string;
  activities: Activity[];
}

export interface FixedCommitment {
  title: string;
  time?: string;
  date?: string;
  status: string;
  platform?: string;
  isHardDeadline?: boolean;
  advancePaid?: number;
  timeWindow?: string;
  breakfastIncluded?: boolean;
  phone?: string;
}

export interface Trip {
  id: string;
  title: string;
  tagline: string;
  dates: string;
  startDate: string;
  endDate: string;
  totalDistanceKm: number;
  durationHours: number;
  origin: string;
  destinationHub: string;
  commitments: {
    outboundTrain: FixedCommitment;
    returnTrain: FixedCommitment;
    scooterReturn: FixedCommitment;
    kayakingActivity: FixedCommitment;
    [key: string]: FixedCommitment;
  };
  days: DayPlan[];
}

export interface Traveller {
  id: string;
  name: string;
  role: string;
  phone?: string;
  emergencyContact?: string;
  avatar: string;
  isLead?: boolean;
  notes?: string;
}

export type ExpenseCategory =
  | "Scooter Rental"
  | "Petrol"
  | "Accommodation"
  | "Train"
  | "Food and drinks"
  | "Activities"
  | "Entry tickets"
  | "Ferry / Water Metro"
  | "Parking"
  | "Shopping"
  | "Miscellaneous";

export type SplitMethod = "equal" | "percentage" | "custom" | "personal" | "repayment" | "refund";

export interface ExpenseShare {
  travellerId: string;
  amountPaise: number; // Integer minor units (e.g. 50000 = ₹500.00)
  percentage?: number;
}

export interface Expense {
  id: string;
  amount: number; // Display amount in currency
  amountPaise: number; // Integer minor units (₹1 = 100 paise)
  currency: string; // ISO 4217 (e.g. "INR", "USD", "EUR")
  fxRate?: number; // Exchange rate to INR (default: 1.0)
  amountInInrPaise?: number; // Base currency in paise
  description: string;
  category: ExpenseCategory;
  date: string;
  time?: string;
  paidBy: string; // Traveller id ("traveller-1" | "traveller-2")
  participants: string[]; // Traveller ids
  splitMethod: SplitMethod;
  splitDetails?: ExpenseShare[];
  isPrepaid?: boolean;
  status?: "pending" | "settled";
  repaymentTo?: string; // Traveller id if this is a repayment
  receiptNote?: string;
  notes?: string;
  createdAt?: string;
  lastModifiedBy?: string;
}

export interface TripChange {
  id: string;
  timestamp: string; // ISO string
  authorId: string; // "traveller-1" | "traveller-2"
  authorName: string;
  action: "created" | "updated" | "deleted" | "completed" | "skipped" | "material_change" | "preference_updated" | "settlement";
  entityType: "activity" | "expense" | "checklist" | "preference" | "booking" | "collaboration";
  entityId: string;
  description: string;
  field?: string;
  oldValue?: any;
  newValue?: any;
}

export interface MaterialChangeRequest {
  id: string;
  entityType: "activity" | "booking";
  entityId: string;
  title: string;
  requestedBy: string; // authorId
  requestedAt: string;
  consequences: string;
  proposedChanges: Record<string, any>;
  status: "pending_approval" | "approved" | "rejected";
  approvedBy?: string;
  approvedAt?: string;
}

export interface SharedPreferences {
  foodAndDining: {
    dietary: string; // e.g. "Seafood Lovers & Veg Friendly"
    spiceTolerance: "Mild" | "Medium" | "High";
    preferences: string[];
    dislikedFoods: string[];
  };
  budgetSensitivity: {
    tier: "Budget Conscious" | "Comfortable Boutique" | "Luxury";
    targetDailySpendINR: number;
    notes: string;
  };
  physicalTolerances: {
    maxWalkingKmPerDay: number;
    maxScooterRideMinsPerStretch: number;
    heatSunTolerance: "Low" | "Medium" | "High";
  };
  sightseeingPace: "Relaxed & Slow" | "Balanced" | "Action-Packed";
  indoorOutdoorBalance: {
    indoorPct: number; // 0-100
    outdoorPct: number; // 0-100
  };
  restBreaks: {
    requireAfternoonRest: boolean;
    restWindow: string; // e.g. "02:00 PM - 04:00 PM"
  };
  vetoList: string[]; // Hard "do NOT want to do" list
}

export interface LocationCheckIn {
  id: string;
  travellerId: string;
  travellerName: string;
  timestamp: string;
  locationName: string;
  lat?: number;
  lng?: number;
  note?: string;
}

export interface LiveLocationSharing {
  enabled: boolean;
  activeTravellerId?: string;
  activatedAt?: string;
  expiresAt?: string;
  durationMins?: number;
  currentLat?: number;
  currentLng?: number;
  lastUpdated?: string;
  checkIns: LocationCheckIn[];
}

export interface CollaborationConfig {
  activeTravellerId: string; // "traveller-1" | "traveller-2"
  isTripPrivate: boolean;
  inviteToken?: string;
  inviteExpiry?: string;
  inviteStatus: "idle" | "pending" | "accepted" | "revoked";
  accessPin?: string;
  partnerConnected: boolean;
  lastSyncedAt?: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  priority?: "High" | "Medium" | "Low";
  day?: number;
  assignedTo?: string; // Traveller id
  completedBy?: string; // Traveller id
  completedAt?: string;
}

export interface ChecklistGroup {
  group: string;
  items: ChecklistItem[];
}

export interface ContactCard {
  id: string;
  name: string;
  role: string;
  location?: string;
  lat?: number;
  lng?: number;
  phone?: string;
  status?: string;
  bookingRef?: string;
  checkIn?: string;
  checkOut?: string;
  returnDeadline?: string;
  time?: string;
  breakfastProvided?: boolean;
  isUserProvided?: boolean;
  verified?: boolean;
  verificationSource?: string;
  notes?: string;
}

export interface OptionalPlace {
  id: string;
  name: string;
  area: string;
  category: ActivityCategory;
  lat: number;
  lng: number;
  visitingHours: string;
  entryFee: string;
  recommendedDay: number;
  detourKm: number;
  estimatedMins: number;
  desc: string;
}

export interface TravelMemory {
  id: string;
  tripId: string;
  dayNumber?: number;
  activityId?: string;
  timestamp: string;
  title: string;
  notes: string;
  authorId: string; // Traveller id
  photos?: string[]; // Base64 data URLs or asset references
  tags?: string[];
  mood?: "inspiring" | "peaceful" | "adventurous" | "delicious" | "exhausting";
}

export interface AiAssistantConfig {
  provider: "gemini" | "offline";
  apiKey?: string;
  model?: string;
  enabled: boolean;
}

export interface ReminderConfig {
  id: string;
  activityId?: string;
  commitmentId?: string;
  title: string;
  scheduledTime: string; // ISO string
  triggerMinutesBefore: number; // e.g. 15, 30, 60
  category: "departure" | "checkin" | "activity" | "booking_deadline" | "weather_disruption" | "custom";
  status: "scheduled" | "fired" | "snoozed" | "dismissed";
  snoozedUntil?: string;
  isQuietHourMuted?: boolean;
  isHardConstraint?: boolean;
}

export interface ReminderSettings {
  enabled: boolean;
  defaultLeadMins: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "22:30"
  quietHoursEnd: string; // "06:30"
  timeZone: string; // "Asia/Kolkata"
}

export interface TravelLeg {
  id: string;
  fromActivityId: string;
  toActivityId: string;
  fromName: string;
  toName: string;
  fromCoords: [number, number];
  toCoords: [number, number];
  distanceKm: number;
  durationMins: number;
  uncertaintyBufferMins: number;
  totalDurationWithBufferMins: number;
  provider: "osrm" | "haversine_coastal_estimate";
  lastUpdated: string;
  navigationUrl: string;
}

export interface FeasibilityIssue {
  activityId: string;
  activityTitle: string;
  type: "hard_constraint_violation" | "venue_closed" | "arrival_delayed" | "buffer_breach";
  severity: "danger" | "warning";
  plannedTime: string;
  predictedArrival: string;
  predictedDeparture: string;
  message: string;
}

export interface FeasibilityRecommendationAction {
  actionType: "shorten" | "skip" | "reschedule" | "replace";
  activityId: string;
  activityTitle: string;
  details: string;
  timeSavedMins: number;
  substituteBackupId?: string;
}

export interface FeasibilityRecommendation {
  id: string;
  timestamp: string;
  dayId: string;
  delayMins: number;
  issues: FeasibilityIssue[];
  preservedBookings: string[];
  actions: FeasibilityRecommendationAction[];
  explanation: string;
  status: "pending_approval" | "approved" | "rejected";
}

export interface WeatherForecast {
  locationName: string;
  lat: number;
  lng: number;
  retrievedAt: string;
  current: {
    temperature: number;
    weatherCode: number;
    weatherDesc: string;
    windSpeedKmH: number;
    precipitationMm: number;
  };
  forecast: {
    date: string;
    maxTemp: number;
    minTemp: number;
    rainProbability: number;
    precipitationTotalMm: number;
    maxWindSpeedKmH: number;
  }[];
}

export interface CoastalActivityRisk {
  activityId: string;
  activityTitle: string;
  activityType: "kayaking" | "beach" | "coastal_ride" | "lighthouse" | "standup_paddling";
  riskLevel: "low" | "moderate" | "high";
  advisoryTitle: string;
  advisoryDetails: string;
  operatorContact?: string;
  recommendation: string;
}

export interface StructuredBackup {
  id: string;
  name: string;
  category: "Cafe" | "Restaurant" | "Beach" | "Activity" | "Cultural" | "Temple" | "Stay";
  address: string;
  lat: number;
  lng: number;
  verifiedLocation: boolean;
  rating: number; // e.g. 4.6
  reviewCount: number; // e.g. 1420
  ratingProvider: string; // e.g. "Google Maps (verified Oct 2026)"
  priceRange: "₹" | "₹₹" | "₹₹₹" | "₹₹₹₹";
  pricingSource: string; // e.g. "Audited menu Oct 2026"
  phone: string;
  openingHours: string; // e.g. "09:00 AM - 08:00 PM"
  closureDays: string[]; // e.g. ["Friday"]
  bookingRequired: boolean;
  bookingDetails?: string;
  suitableReplacements: string[]; // activity IDs or categories it can replace
  lastVerified: string;
  isNotVerified?: boolean;
}

export interface TripNotification {
  id: string;
  type: "delay" | "booking_deadline" | "weather_disruption" | "schedule_conflict" | "departure_reminder";
  title: string;
  reason: string;
  relevantTime: string;
  source: string;
  recommendedActionText: string;
  actionPayload?: any;
  timestamp: string;
  status: "active" | "accepted" | "dismissed" | "snoozed";
  snoozedUntil?: string;
}

export interface AiAdjustmentProposal {
  id: string;
  timestamp: string;
  promptContext: string;
  proposedChanges: {
    dayId: string;
    activityId: string;
    newTime: string;
    action: "shorten" | "skip" | "move";
    rationale: string;
  }[];
  validationResult: {
    isValid: boolean;
    violations: string[];
    hardConstraintsPreserved: boolean;
  };
  status: "pending" | "approved" | "rejected";
}

export interface MasterAppState {
  schemaVersion: number;
  activeTripId: string;
  theme: "coastal-light" | "coastal-dark";
  travellers: Traveller[];
  trips: Trip[];
  expenses: Expense[];
  checklist: ChecklistGroup[];
  contacts: ContactCard[];
  optionalPlaces: OptionalPlace[];
  memories: TravelMemory[];
  aiSettings: AiAssistantConfig;
  collaboration: CollaborationConfig;
  preferences: SharedPreferences;
  changeHistory: TripChange[];
  materialChanges: MaterialChangeRequest[];
  locationSharing: LiveLocationSharing;
  // Stage 3 Engine Extensions
  reminders: ReminderConfig[];
  reminderSettings: ReminderSettings;
  activeRecommendations: FeasibilityRecommendation[];
  notifications: TripNotification[];
  backupDatabase: StructuredBackup[];
  routingCache: { [key: string]: TravelLeg };
  weatherCache: { [key: string]: WeatherForecast };
  aiProposals: AiAdjustmentProposal[];
}


