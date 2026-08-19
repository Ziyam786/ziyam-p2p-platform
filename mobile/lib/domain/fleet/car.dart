/// Mirrors `prisma/schema.prisma`'s `Car` model, public fields only.
/// `originalImages` (admin-only unblurred originals) is deliberately never
/// modeled or requested here.
class Car {
  const Car({
    required this.id,
    required this.make,
    required this.model,
    required this.year,
    required this.category,
    required this.fuelType,
    required this.transmission,
    required this.seats,
    required this.dailyRate,
    required this.securityDeposit,
    required this.city,
    required this.images,
    this.address,
    this.description,
    this.instantBook = false,
  });

  final String id;
  final String make;
  final String model;
  final int year;
  final String category;
  final String fuelType;
  final String transmission;
  final int seats;
  final double dailyRate;
  final double securityDeposit;
  final String city;
  final List<String> images;
  final String? address;
  final String? description;

  /// Instant-book vs request-to-book. Not yet a first-class Car field in
  /// the schema at the time of writing — surfaced from whatever field the
  /// backend response includes (see contracts/rest-api.md); defaults to
  /// false (request-to-book) if absent, the safer default of the two.
  final bool instantBook;

  String get displayName => '$make $model';

  factory Car.fromJson(Map<String, dynamic> json) => Car(
        id: json['id'] as String,
        make: json['make'] as String,
        model: json['model'] as String,
        year: json['year'] as int,
        category: json['category'] as String,
        fuelType: json['fuelType'] as String,
        transmission: json['transmission'] as String,
        seats: json['seats'] as int? ?? 5,
        dailyRate: (json['dailyRate'] as num).toDouble(),
        securityDeposit: (json['securityDeposit'] as num?)?.toDouble() ?? 0,
        city: json['city'] as String,
        images: (json['images'] as List?)?.cast<String>() ?? const [],
        address: json['address'] as String?,
        description: json['description'] as String?,
        instantBook: json['instantBook'] as bool? ?? false,
      );
}

enum AvailabilityBlockType { booked, paused }

class AvailabilityBlock {
  const AvailabilityBlock({required this.startDate, required this.endDate, required this.type, this.reason});

  final DateTime startDate;
  final DateTime endDate;
  final AvailabilityBlockType type;
  final String? reason;

  bool overlaps(DateTime start, DateTime end) => start.isBefore(endDate) && end.isAfter(startDate);

  factory AvailabilityBlock.fromJson(Map<String, dynamic> json) => AvailabilityBlock(
        startDate: DateTime.parse(json['startDate'] as String),
        endDate: DateTime.parse(json['endDate'] as String),
        type: (json['type'] as String) == 'BOOKED'
            ? AvailabilityBlockType.booked
            : AvailabilityBlockType.paused,
        reason: json['reason'] as String?,
      );
}
