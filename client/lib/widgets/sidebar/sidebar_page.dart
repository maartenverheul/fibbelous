import 'package:flutter/material.dart' hide Page;
import 'package:client/models/page.dart';

class SidebarPage extends StatefulWidget {
  final Page page;

  const SidebarPage({super.key, required this.page});

  @override
  State<SidebarPage> createState() => _SidebarPageState();
}

class _SidebarPageState extends State<SidebarPage> {
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2.0, horizontal: 8.0),
      child: InkWell(
        onTap: () {
          // Handle tap
        },
        child: Container(
          padding: const EdgeInsets.all(4.0),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            children: [
              Text(widget.page.icon),
              Text(widget.page.title),
              Expanded(child: Container()),
              Icon(Icons.chevron_right, color: Theme.of(context).focusColor),
            ],
          ),
        ),
      ),
    );
  }
}
