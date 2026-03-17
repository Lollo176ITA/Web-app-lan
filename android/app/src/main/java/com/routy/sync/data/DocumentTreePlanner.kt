package com.routy.sync.data

import android.database.Cursor
import android.content.Context
import android.net.Uri
import android.provider.DocumentsContract
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
    val entries = mutableListOf<LocalSyncEntry>()
    val rootDocumentId = runCatching { DocumentsContract.getTreeDocumentId(treeUri) }.getOrNull()

    if (rootDocumentId == null) {
      return buildEntriesWithDocumentFile(treeUri)
    }

    return runCatching {
      visitDocumentTree(entries, treeUri, rootDocumentId, prefix = "")
      entries.sortedBy { it.relativePath }
    }.getOrElse {
      buildEntriesWithDocumentFile(treeUri)
    }
  }

  private fun visitDocumentTree(
    entries: MutableList<LocalSyncEntry>,
    treeUri: Uri,
    documentId: String,
    prefix: String
  ) {
    val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, documentId)
    context.contentResolver.query(childrenUri, PROJECTION, null, null, null)?.use { cursor ->
      while (cursor.moveToNext()) {
        val childDocumentId = cursor.getStringOrNull(DOCUMENT_ID_INDEX) ?: continue
        val displayName = cursor.getStringOrNull(DISPLAY_NAME_INDEX)?.trim().orEmpty()

        if (displayName.isBlank()) {
          continue
        }

        val mimeType = cursor.getStringOrNull(MIME_TYPE_INDEX).orEmpty()
        val relativePath = if (prefix.isBlank()) displayName else "$prefix/$displayName"

        if (mimeType == DocumentsContract.Document.MIME_TYPE_DIR) {
          visitDocumentTree(entries, treeUri, childDocumentId, relativePath)
          continue
        }

        entries += LocalSyncEntry(
          relativePath = relativePath,
          sizeBytes = cursor.getLongOrZero(SIZE_INDEX),
          modifiedAtMs = cursor.getLongOrZero(LAST_MODIFIED_INDEX),
          documentUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, childDocumentId),
          mimeType = mimeType.ifBlank { "application/octet-stream" }
        )
      }
    } ?: throw IllegalStateException("Unable to query tree children for $treeUri")
  }

  private fun buildEntriesWithDocumentFile(treeUri: Uri): List<LocalSyncEntry> {
    val root = DocumentFile.fromTreeUri(context, treeUri) ?: return emptyList()
    val entries = mutableListOf<LocalSyncEntry>()
    visitWithDocumentFile(entries, root, prefix = "")
    return entries.sortedBy { it.relativePath }
  }

  private fun visitWithDocumentFile(entries: MutableList<LocalSyncEntry>, document: DocumentFile, prefix: String) {
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
      visitWithDocumentFile(entries, child, childPrefix)
    }
  }

  private fun Cursor.getStringOrNull(index: Int): String? {
    if (isNull(index)) {
      return null
    }

    return getString(index)
  }

  private fun Cursor.getLongOrZero(index: Int): Long {
    if (isNull(index)) {
      return 0L
    }

    return getLong(index)
  }

  companion object {
    private val PROJECTION = arrayOf(
      DocumentsContract.Document.COLUMN_DOCUMENT_ID,
      DocumentsContract.Document.COLUMN_DISPLAY_NAME,
      DocumentsContract.Document.COLUMN_MIME_TYPE,
      DocumentsContract.Document.COLUMN_SIZE,
      DocumentsContract.Document.COLUMN_LAST_MODIFIED
    )
    private const val DOCUMENT_ID_INDEX = 0
    private const val DISPLAY_NAME_INDEX = 1
    private const val MIME_TYPE_INDEX = 2
    private const val SIZE_INDEX = 3
    private const val LAST_MODIFIED_INDEX = 4
  }
}
