import 'package:flutter/material.dart';
import 'package:theme_provider/theme_provider.dart';

class Themes {
  static final Color _lightFocusColor = Colors.black.withOpacity(0.12);
  static final Color _darkFocusColor = Colors.white.withOpacity(0.12);

  static ThemeData themeData(ColorScheme colorScheme, Color focusColor) {
    return ThemeData(colorScheme: colorScheme, focusColor: focusColor);
  }

  static ThemeData lightThemeData = themeData(
    lightColorScheme,
    _lightFocusColor,
  );

  static ThemeData darkThemeData = themeData(
    darkColorScheme,
    _darkFocusColor,
  );

  static AppTheme lightTheme =
      AppTheme(id: "light", data: lightThemeData, description: "Light theme");
  static AppTheme darkTheme =
      AppTheme(id: "dark", data: darkThemeData, description: "Dark theme");

  static ColorScheme lightColorScheme = ColorScheme.light(
    primary: const Color(0xFFB93C5D),
    surface: Colors.grey.shade100,
    surfaceContainer: Colors.grey.shade200,
    outline: Colors.grey.shade400,
  );
  static ColorScheme darkColorScheme = ColorScheme.dark(
    primary: const Color(0xFFFF8383),
    surface: const Color.fromARGB(255, 44, 44, 44),
    surfaceContainer: Colors.grey.shade800,
    outline: Colors.grey.shade700,
  );
}
