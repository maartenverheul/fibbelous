import 'package:client/models/workspace.dart';
import 'package:client/providers/workspace_provider.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class WorkspaceSelector extends StatefulWidget {
  const WorkspaceSelector({super.key});

  @override
  State<WorkspaceSelector> createState() => _WorkspaceSelectorState();
}

class _WorkspaceSelectorState extends State<WorkspaceSelector> {
  @override
  Widget build(BuildContext context) {
    return Consumer<WorkspaceProvider>(
      builder: (context, workspaceProvider, chilld) => LayoutBuilder(
        builder: (context, constraints) => DropdownButton<Workspace>(
          value: workspaceProvider.selectedWorkspace,
          isExpanded: true,
          icon: Offstage(
            offstage: constraints.maxWidth < 95,
            child: Icon(
              Icons.chevron_right,
              color: Theme.of(context).colorScheme.onSurface,
              size: IconTheme.of(context).size,
            ),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
          underline: Container(
            height: 0,
            color: Colors.transparent,
          ),
          onChanged: (Workspace? value) {
            if (value == null) return;
            workspaceProvider.activateWorkspace(value);
          },
          items: workspaceProvider.workspaces.map<DropdownMenuItem<Workspace>>(
            (Workspace value) {
              return DropdownMenuItem<Workspace>(
                value: value,
                child: LayoutBuilder(
                  builder: (context, constraints2) => Row(
                    children: [
                      SizedBox(
                        width: 40,
                        child: Text(
                          value.icon,
                          style: const TextStyle(fontSize: 20),
                        ),
                      ),
                      Flexible(
                        fit: FlexFit.loose,
                        child: Offstage(
                          offstage: constraints2.maxWidth < 100,
                          child: Text(
                            value.name,
                            maxLines: 1,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ).toList(),
        ),
      ),
    );
  }
}
