import 'package:firebase_ai/firebase_ai.dart';

import '../../domain/itinerary/itinerary_unlock.dart';

/// Mirrors `generateRoadTripItinerary()` in `src/frontend/lib/firebase.ts:224-242`
/// field-for-field — same model, same prompt, same destination briefs — so
/// the two clients produce consistent output. Requires `Firebase.initializeApp()`
/// (via the generated `firebase_options.dart`, see tasks.md T004) to have
/// already run before this is called.
class ItineraryAiService {
  static const _model = 'gemini-flash-latest';

  Future<String> generate(String destination) async {
    final brief = itineraryDestinations[destination] ?? destination;
    final model = FirebaseAI.googleAI().generativeModel(model: _model);

    final prompt =
        'You are a travel expert writing a road-trip itinerary for a self-drive car rental customer '
        'of ZiyamSelfDrive, a P2P car rental platform in Bengaluru. Write a well-organized, specific '
        'day-by-day itinerary in plain text (use line breaks and simple dashes for structure, no '
        'markdown headers). Include: route overview and driving distance/time from Bengaluru, '
        'recommended trip duration, suggested stops along the way, key attractions at the destination, '
        'best time to visit, and practical self-drive tips (fuel stops, road conditions, parking). Keep '
        'it genuinely useful and specific to the destination, not generic filler.\n\n'
        'Write the itinerary for a Bengaluru to $destination road trip. $brief.';

    final result = await model.generateContent([Content.text(prompt)]);
    final text = (result.text ?? '').trim();
    if (text.length < 80) {
      throw StateError('Itinerary generation returned too little text');
    }
    return text;
  }
}
