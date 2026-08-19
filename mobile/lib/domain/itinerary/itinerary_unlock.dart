/// Mirrors `prisma/schema.prisma`'s `ItineraryUnlock` model. Per
/// research.md's correction, this is an anonymous, id-scoped guest
/// purchase — NOT linked to a `User` or `Booking` — so there is no
/// `customerId` field here to mirror.
class ItineraryUnlock {
  const ItineraryUnlock({
    required this.id,
    required this.destination,
    required this.amount,
    required this.status,
    this.generatedContent,
  });

  final String id;
  final String destination;
  final double amount;
  final ItineraryUnlockStatus status;
  final String? generatedContent;

  /// Matches the web client's own sentinel check (`itinerary.routes.ts:75`)
  /// for "technically has content, but it's the failure placeholder."
  bool get hasRealContent =>
      generatedContent != null &&
      generatedContent!.length >= 80 &&
      !generatedContent!.toLowerCase().contains("couldn't generate your itinerary");

  factory ItineraryUnlock.fromJson(Map<String, dynamic> json) => ItineraryUnlock(
        id: json['id'] as String,
        destination: json['destination'] as String,
        amount: (json['amount'] as num?)?.toDouble() ?? 49,
        status: ItineraryUnlockStatus.fromWire(json['status'] as String?),
        generatedContent: json['generatedContent'] as String?,
      );
}

enum ItineraryUnlockStatus {
  pendingPayment,
  paid,
  failed,
  unknown;

  static ItineraryUnlockStatus fromWire(String? value) {
    switch (value) {
      case 'PAID':
        return ItineraryUnlockStatus.paid;
      case 'PENDING_PAYMENT':
        return ItineraryUnlockStatus.pendingPayment;
      case 'FAILED':
        return ItineraryUnlockStatus.failed;
      default:
        return ItineraryUnlockStatus.unknown;
    }
  }
}

/// Kept in sync with `ITINERARY_DESTINATIONS` in
/// `src/backend/routes/itinerary.routes.ts:11-16` — the web client
/// duplicates the same constant rather than fetching it, and this app
/// follows the same pattern rather than inventing a new shared-config
/// endpoint for four static strings (see contracts/firebase-ai-itinerary.md).
const Map<String, String> itineraryDestinations = {
  'Ooty':
      'a hill station ~270 km from Bengaluru, known for tea gardens, the Nilgiri toy train, and cool weather',
  'Coorg':
      'a coffee-growing hill district ~250 km from Bengaluru, known for coffee plantations, waterfalls, and Kodava cuisine',
  'Chikmagalur':
      'a misty hill town ~245 km from Bengaluru, known for coffee estates, trekking (Mullayanagiri), and quiet homestays',
  'Gokarna':
      'a beach town ~480 km from Bengaluru, known for its temple town heritage and quieter alternative to Goa',
};
