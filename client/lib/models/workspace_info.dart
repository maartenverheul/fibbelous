import 'dart:convert';

class WorkspaceInfo {
  WorkspaceInfo({
    required this.id,
    required this.slug,
    required this.title,
    required this.description,
    required this.createdAt,
    this.icon = "",
  });

  String id;
  String slug;
  String title;
  String description;
  String createdAt;
  String icon;

  factory WorkspaceInfo.fromJson(Map<String, dynamic> json) {
    return WorkspaceInfo(
      id: json['id'].toString(),
      slug: json['slug'] as String? ?? '',
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      createdAt: json['created_at'] as String? ?? '',
      icon: json['icon'] as String? ?? '',
    );
  }

  static List<WorkspaceInfo> listFromJson(String body) {
    final List<dynamic> data = jsonDecode(body);
    return data
        .map((e) => WorkspaceInfo.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
