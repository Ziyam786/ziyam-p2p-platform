import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Ziyam SelfDrive design tokens, ported from the web design system
/// (Essence Blue accent, Manrope type, dark slate ops surfaces). Do not
/// introduce a second palette — extend this file instead.
abstract final class ZiyamColors {
  static const essenceBlue = Color(0xFF183EEB);
  static const brand400 = Color(0xFF5872EA);
  static const brand700 = Color(0xFF0E259D);

  static const slate50 = Color(0xFFF8FAFC);
  static const slate200 = Color(0xFFE2E8F0);
  static const slate400 = Color(0xFF94A3B8);
  static const slate500 = Color(0xFF64748B);
  static const slate800 = Color(0xFF1E293B);
  static const slate900 = Color(0xFF0F172A);
  static const slate950 = Color(0xFF020617);

  static const emerald500 = Color(0xFF10B981);
  static const emerald600 = Color(0xFF059669);
  static const accentOrange = Color(0xFFFF7200);
  static const red500 = Color(0xFFEF4444);

  static const navy900 = Color(0xFF000250);
}

abstract final class ZiyamRadius {
  static const md = 8.0;
  static const lg = 12.0;
  static const xl = 16.0;
  static const xxl = 24.0;
}

abstract final class ZiyamSpacing {
  static const s1 = 4.0;
  static const s2 = 8.0;
  static const s3 = 12.0;
  static const s4 = 16.0;
  static const s6 = 24.0;
  static const s8 = 32.0;
}

/// The renter/customer app's light theme — bright category/search/booking
/// surfaces, matching the web app's white-and-navy marketing register.
ThemeData ziyamLightTheme() {
  final textTheme = GoogleFonts.manropeTextTheme();
  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    scaffoldBackgroundColor: Colors.white,
    colorScheme: ColorScheme.fromSeed(
      seedColor: ZiyamColors.essenceBlue,
      brightness: Brightness.light,
      primary: ZiyamColors.essenceBlue,
      secondary: ZiyamColors.emerald500,
      error: ZiyamColors.red500,
    ),
    textTheme: textTheme.apply(
      bodyColor: ZiyamColors.navy900,
      displayColor: ZiyamColors.navy900,
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: Colors.white,
      foregroundColor: ZiyamColors.navy900,
      elevation: 0,
      titleTextStyle: GoogleFonts.manrope(
        fontWeight: FontWeight.w800,
        fontSize: 18,
        color: ZiyamColors.navy900,
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: ZiyamColors.essenceBlue,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(ZiyamRadius.lg),
        ),
        textStyle: GoogleFonts.manrope(fontWeight: FontWeight.w700),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(ZiyamRadius.lg),
        borderSide: BorderSide(color: ZiyamColors.slate200),
      ),
    ),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ZiyamRadius.xl),
        side: BorderSide(color: ZiyamColors.slate200),
      ),
    ),
  );
}

/// Dark, high-contrast "ops" theme — used for live/utility surfaces
/// (booking checkout summaries, itinerary generation state) that mirror the
/// web app's slate-950 product sections rather than the light marketing UI.
ThemeData ziyamDarkTheme() {
  final textTheme = GoogleFonts.manropeTextTheme(ThemeData.dark().textTheme);
  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: ZiyamColors.slate950,
    colorScheme: ColorScheme.fromSeed(
      seedColor: ZiyamColors.essenceBlue,
      brightness: Brightness.dark,
      primary: ZiyamColors.brand400,
      secondary: ZiyamColors.emerald500,
      surface: ZiyamColors.slate900,
      error: ZiyamColors.red500,
    ),
    textTheme: textTheme.apply(bodyColor: Colors.white, displayColor: Colors.white),
    cardTheme: CardThemeData(
      color: ZiyamColors.slate900,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ZiyamRadius.xl),
        side: BorderSide(color: ZiyamColors.slate800),
      ),
    ),
  );
}
