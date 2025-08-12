import 'package:client/router.dart';
import 'package:client/theme.dart';
import 'package:flutter/material.dart';
import 'package:theme_provider/theme_provider.dart';

class App extends StatelessWidget {
  const App({super.key});

  // This widget is the Home of your application.
  @override
  Widget build(BuildContext context) {
    return ThemeProvider(
      defaultThemeId: "dark",
      themes: [
        Themes.lightTheme,
        Themes.darkTheme,
      ],
      child: ThemeConsumer(
        child: Builder(
          builder: (themeContext) => MaterialApp.router(
            title: 'Fibbelous',
            theme: ThemeProvider.themeOf(themeContext).data,
            routerConfig: router,
          ),
        ),
      ),
    );
  }
}
