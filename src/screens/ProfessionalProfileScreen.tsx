import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import {
  LANGUAGES,
  Modality,
  MODALITIES,
  PROFESSIONAL_ROLES,
  ProfessionalRole,
  updateMyProfessionalProfile,
  uploadMyProfessionalPhoto,
} from '@/data/sharing';

const RATE_STATUS: Record<string, { label: string; color: string }> = {
  none: { label: 'No rate proposed yet', color: Colors.textMuted },
  pending: { label: 'Pending HomeTest review', color: Colors.warning },
  approved: { label: 'Approved', color: Colors.accent },
  rejected: { label: 'Not approved, please review', color: Colors.danger },
};

// Ficha del profesional: la ven los pacientes (excepto la tarifa propuesta, que
// solo ven el propio profesional y HomeTest hasta que se aprueba).
export const ProfessionalProfileScreen = () => {
  const router = useRouter();
  const { professional, refreshProfessional } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<ProfessionalRole>('doctor');
  const [specialty, setSpecialty] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseCollege, setLicenseCollege] = useState('');
  const [city, setCity] = useState('');
  const [years, setYears] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [modalities, setModalities] = useState<Modality[]>([]);
  const [bio, setBio] = useState('');
  const [rate, setRate] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!professional) return;
    setDisplayName(professional.displayName);
    setRole(professional.role);
    setSpecialty(professional.specialty ?? '');
    setLicenseNumber(professional.licenseNumber ?? '');
    setLicenseCollege(professional.licenseCollege ?? '');
    setCity(professional.city ?? '');
    setYears(professional.yearsExperience != null ? String(professional.yearsExperience) : '');
    setLanguages(professional.languages);
    setModalities(professional.modalities);
    setBio(professional.bio ?? '');
    setRate(professional.hourlyRateRequestedEur != null ? String(professional.hourlyRateRequestedEur) : '');
    // Solo al abrir la pantalla: no pisar lo que el profesional está escribiendo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professional?.id]);

  if (!professional) return null;

  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  const pickPhoto = async () => {
    setMessage('');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      await uploadMyProfessionalPhoto(result.assets[0].uri);
      await refreshProfessional();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not upload the photo');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setMessage('');
    const rateNumber = rate.trim() ? Number(rate.replace(',', '.')) : null;
    const yearsNumber = years.trim() ? Number(years) : null;
    if (!displayName.trim()) return setMessage('Please enter your name');
    if (rateNumber !== null && !(rateNumber > 0)) return setMessage('The hourly rate must be a positive number');
    if (yearsNumber !== null && !(yearsNumber >= 0 && yearsNumber <= 70)) return setMessage('Years of experience: 0-70');
    setSaving(true);
    try {
      await updateMyProfessionalProfile({
        displayName: displayName.trim(),
        role,
        specialty: specialty.trim(),
        licenseNumber: licenseNumber.trim(),
        licenseCollege: licenseCollege.trim(),
        city: city.trim(),
        yearsExperience: yearsNumber,
        languages,
        modalities,
        bio: bio.trim(),
        hourlyRateRequestedEur: rateNumber,
      });
      await refreshProfessional();
      router.back();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const status = RATE_STATUS[professional.rateStatus ?? 'none'];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ScreenHeader title="Professional profile" showBack />

          <TouchableOpacity style={styles.photoWrap} onPress={pickPhoto} disabled={uploading} activeOpacity={0.85}>
            {professional.photoUrl ? (
              <Image source={{ uri: professional.photoUrl }} style={styles.photo} contentFit="cover" />
            ) : (
              <View style={[styles.photo, styles.photoEmpty]}>
                <Ionicons name="person" size={44} color={Colors.textMuted} />
              </View>
            )}
            <View style={styles.photoBadge}>
              {uploading ? (
                <ActivityIndicator size="small" color={Colors.background} />
              ) : (
                <Ionicons name="camera" size={16} color={Colors.background} />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.photoHint}>Patients see this photo in the directory</Text>

          <Text style={styles.label}>Full name</Text>
          <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="Dr. Laura Méndez" placeholderTextColor={Colors.textMuted} />

          <Text style={styles.label}>Profession</Text>
          <View style={styles.chips}>
            {PROFESSIONAL_ROLES.map((r) => (
              <TouchableOpacity key={r.id} style={[styles.chip, role === r.id && styles.chipOn]} onPress={() => setRole(r.id)}>
                <Text style={[styles.chipText, role === r.id && styles.chipTextOn]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Specialty</Text>
          <TextInput style={styles.input} value={specialty} onChangeText={setSpecialty} placeholder="e.g. Internal medicine" placeholderTextColor={Colors.textMuted} />

          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Registration number</Text>
              <TextInput style={styles.input} value={licenseNumber} onChangeText={setLicenseNumber} placeholder="Nº de colegiado" placeholderTextColor={Colors.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Years of experience</Text>
              <TextInput style={styles.input} value={years} onChangeText={setYears} keyboardType="number-pad" placeholder="10" placeholderTextColor={Colors.textMuted} />
            </View>
          </View>

          <Text style={styles.label}>Professional college</Text>
          <TextInput style={styles.input} value={licenseCollege} onChangeText={setLicenseCollege} placeholder="e.g. Colegio de Médicos de Madrid" placeholderTextColor={Colors.textMuted} />

          <Text style={styles.label}>City</Text>
          <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="Madrid" placeholderTextColor={Colors.textMuted} />

          <Text style={styles.label}>Languages</Text>
          <View style={styles.chips}>
            {LANGUAGES.map((l) => (
              <TouchableOpacity key={l} style={[styles.chip, languages.includes(l) && styles.chipOn]} onPress={() => setLanguages(toggle(languages, l))}>
                <Text style={[styles.chipText, languages.includes(l) && styles.chipTextOn]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>How you see patients</Text>
          <View style={styles.chips}>
            {MODALITIES.map((m) => (
              <TouchableOpacity key={m.id} style={[styles.chip, modalities.includes(m.id) && styles.chipOn]} onPress={() => setModalities(toggle(modalities, m.id))}>
                <Text style={[styles.chipText, modalities.includes(m.id) && styles.chipTextOn]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>About you</Text>
          <TextInput
            style={[styles.input, styles.bio]}
            value={bio}
            onChangeText={setBio}
            multiline
            placeholder="What you help patients with, your approach…"
            placeholderTextColor={Colors.textMuted}
          />

          <Text style={styles.label}>Hourly rate (€)</Text>
          <TextInput style={styles.input} value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="90" placeholderTextColor={Colors.textMuted} />
          <View style={styles.rateStatus}>
            <View style={[styles.dot, { backgroundColor: status.color }]} />
            <Text style={[styles.rateStatusText, { color: status.color }]}>
              {status.label}
              {professional.rateStatus === 'approved' && professional.hourlyRateEur != null
                ? ` · €${professional.hourlyRateEur}/h visible to patients`
                : ''}
            </Text>
          </View>
          <Text style={styles.hint}>
            HomeTest reviews every rate before patients see it. Changing it sends it back to review.
          </Text>
          {professional.reviewNote ? <Text style={styles.note}>Note from HomeTest: {professional.reviewNote}</Text> : null}

          {message ? <Text style={styles.error}>{message}</Text> : null}
        </ScrollView>

        <TouchableOpacity style={[styles.cta, saving && styles.ctaDisabled]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color={Colors.background} /> : <Text style={styles.ctaText}>Save profile</Text>}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  photoWrap: { alignSelf: 'center', marginTop: 4 },
  photo: { width: 108, height: 108, borderRadius: 54 },
  photoEmpty: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, justifyContent: 'center', alignItems: 'center' },
  photoBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  photoHint: { color: Colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 8 },
  label: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: Colors.textPrimary,
    fontSize: 15,
  },
  bio: { minHeight: 96, textAlignVertical: 'top' },
  row2: { flexDirection: 'row', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  chipText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: Colors.textPrimary },
  rateStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rateStatusText: { fontSize: 13, fontWeight: '700' },
  hint: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 6 },
  note: { color: Colors.textPrimary, fontSize: 13, marginTop: 10, backgroundColor: Colors.card, borderRadius: 10, padding: 10 },
  error: { color: Colors.danger, fontSize: 13, marginTop: 14 },
  cta: { backgroundColor: Colors.accent, borderRadius: 30, paddingVertical: 15, alignItems: 'center', marginHorizontal: 20, marginBottom: 12 },
  ctaDisabled: { backgroundColor: Colors.cardBorder },
  ctaText: { color: Colors.background, fontSize: 16, fontWeight: '700' },
});
