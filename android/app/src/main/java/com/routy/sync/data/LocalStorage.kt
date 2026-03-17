package com.routy.sync.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.PreferenceDataStoreFactory
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStoreFile
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.io.IOException
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

@Entity(tableName = "sync_mappings")
data class SyncMappingEntity(
  @PrimaryKey val localId: String,
  val sourceName: String,
  val treeUri: String,
  val serverMappingId: String?,
  val lastPlannedAt: Long?,
  val lastSyncedAt: Long?
)

@Dao
interface SyncMappingDao {
  @Query("SELECT * FROM sync_mappings ORDER BY sourceName ASC")
  fun observeAll(): Flow<List<SyncMappingEntity>>

  @Query("SELECT * FROM sync_mappings ORDER BY sourceName ASC")
  suspend fun getAll(): List<SyncMappingEntity>

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun upsert(mapping: SyncMappingEntity)

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun upsertAll(mappings: List<SyncMappingEntity>)

  @Query("DELETE FROM sync_mappings WHERE localId NOT IN (:localIds)")
  suspend fun deleteMissing(localIds: List<String>)

  @Query("DELETE FROM sync_mappings WHERE localId = :localId")
  suspend fun deleteById(localId: String)
}

@Database(entities = [SyncMappingEntity::class], version = 1, exportSchema = false)
abstract class SyncDatabase : RoomDatabase() {
  abstract fun mappingDao(): SyncMappingDao

  companion object {
    fun create(context: Context): SyncDatabase =
      Room.databaseBuilder(context, SyncDatabase::class.java, "routy-sync.db").build()
  }
}

data class SyncPreferencesState(
  val hostUrl: String = "",
  val deviceId: String = "",
  val deviceName: String = ""
) {
  val isConfigured: Boolean
    get() = hostUrl.isNotBlank() && deviceId.isNotBlank()
}

class SyncPreferences(private val context: Context) {
  private val dataStoreFile by lazy { context.preferencesDataStoreFile("sync-prefs.preferences_pb") }
  private val dataStore by lazy {
    PreferenceDataStoreFactory.create(
      produceFile = { dataStoreFile }
    )
  }

  val state: Flow<SyncPreferencesState> =
    dataStore.data
      .catch { error ->
        if (error is IOException) {
          emit(emptyPreferences())
        } else {
          throw error
        }
      }
      .map { preferences ->
        SyncPreferencesState(
          hostUrl = preferences[HOST_URL] ?: "",
          deviceId = preferences[DEVICE_ID] ?: "",
          deviceName = preferences[DEVICE_NAME] ?: ""
        )
      }

  suspend fun getState() = state.first()

  suspend fun saveRegistration(hostUrl: String, deviceId: String, deviceName: String) {
    dataStore.edit { preferences ->
      preferences[HOST_URL] = hostUrl
      preferences[DEVICE_ID] = deviceId
      preferences[DEVICE_NAME] = deviceName
    }
  }

  suspend fun clearAll() {
    dataStore.edit { preferences ->
      preferences.clear()
    }
  }

  companion object {
    private val HOST_URL = stringPreferencesKey("host_url")
    private val DEVICE_ID = stringPreferencesKey("device_id")
    private val DEVICE_NAME = stringPreferencesKey("device_name")
  }
}

class SecureTokenStore(context: Context) {
  private val masterKey = MasterKey.Builder(context)
    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
    .build()

  private val preferences = EncryptedSharedPreferences.create(
    context,
    "sync-secure",
    masterKey,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
  )

  fun readToken() = preferences.getString(KEY_AUTH_TOKEN, "") ?: ""

  fun saveToken(value: String) {
    preferences.edit().putString(KEY_AUTH_TOKEN, value).apply()
  }

  fun clear() {
    preferences.edit().clear().apply()
  }

  companion object {
    private const val KEY_AUTH_TOKEN = "auth_token"
  }
}
