import 'package:client/widgets/sidebar/sidebar_page.dart';
import 'package:client/widgets/sidebar/workspace_selector.dart';
import 'package:flutter/material.dart' hide Page;
import 'package:client/models/page.dart';

class Sidebar extends StatelessWidget {
  const Sidebar({super.key});

  static List<Page> pages = [
    Page(
      id: '1',
      title: 'Page 1',
      icon: '😁',
      content: 'Content for Page 1',
      createdAt: DateTime.now(),
    ),
    Page(
      id: '2',
      title: 'Page 2',
      icon: '😁',
      content: 'Content for Page 2',
      createdAt: DateTime.now(),
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        border: Border(
          right: BorderSide(
            color: Theme.of(context).colorScheme.outline,
            width: 1,
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const WorkspaceSelector(),
          ...pages.map((page) => SidebarPage(page: page)),
        ],
      ),
    );
  }
}
