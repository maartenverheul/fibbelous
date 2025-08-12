import 'package:client/widgets/page_viewer.dart';
import 'package:client/widgets/sidebar/sidebar.dart';
import 'package:flutter/material.dart';
import 'package:multi_split_view/multi_split_view.dart';

class MainView extends StatefulWidget {
  const MainView({super.key});

  @override
  State<MainView> createState() => _MainViewState();
}

class _MainViewState extends State<MainView> {
  final MultiSplitViewController _controller = MultiSplitViewController(
    areas: [
      Area(
          min: 20,
          flex: 100,
          max: 500,
          builder: (context, area) => const Sidebar()),
      Area(
          min: 100,
          flex: 300,
          max: 500,
          builder: (context, area) => const PageViewer()),
    ],
  );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      body: MultiSplitViewTheme(
        data: MultiSplitViewThemeData(
          dividerThickness: 6,
        ),
        child: MultiSplitView(controller: _controller),
      ),
    );
  }
}
