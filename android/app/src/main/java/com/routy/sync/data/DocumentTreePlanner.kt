package com.routy.sync.data

import android.content.Context
import android.net.Uri
import androidx.documentfile.provider.DocumentFile

data class LocalSyncEntry(
  val relativePath: String,
  val sizeBytes: Long,
  val modifiedAtMs: Long,
  val documentUri: Uri,
  val mimeType: String
)

class DocumentTreePlanner(private val context: Context) {
  fun buildEntries(treeUri: Uri): List<LocalSyncEntry> {
    val root = DocumentFile.fromTreeUri(context, treeUri) ?: return emptyList()
    val entries = mutableListOf<LocalSyncEntry>()

    visit(entries, root, prefix = "")
    return entries.sortedBy { it.relativePath }
  }

  private fun visit(entries: MutableList<LocalSyncEntry>, document: DocumentFile, prefix: String) {
    if (!document.canRead()) {
      return
    }

    if (document.isFile) {
      val fileName = document.name?.trim().orEmpty()

      if (fileName.isBlank()) {
        return
      }

      entries += LocalSyncEntry(
        relativePath = if (prefix.isBlank()) fileName else "$prefix/$fileName",
        sizeBytes = document.length(),
        modifiedAtMs = document.lastModified(),
        documentUri = document.uri,
        mimeType = document.type ?: "application/octet-stream"
      )
      return
    }

    if (!document.isDirectory) {
      return
    }

    val nextPrefix = buildString {
      if (prefix.isNotBlank()) {
        append(prefix)
        append("/")
      }

      if (document.parentFile != null && document.name != null) {
        append(document.name)
      }
    }

    val childPrefix = if (document.parentFile == null) prefix else nextPrefix

    document.listFiles().forEach { child ->
      visit(entries, child, childPrefix)
    }
  }
}
