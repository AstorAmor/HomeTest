import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ProjectionChart } from "@/components/ProjectionChart";
import { Colors } from "@/constants/colors";
import { currentReport } from "@/data/reportRepository";
import {
  getActionPlanContentEn,
  getMarkerDisplayNameEn,
  PROJECTION_UNCERTAINTY_NOTE_EN,
} from "@/data/reportContentEn";

const CONFIDENCE_COLOR: Record<string, string> = {
  alta: Colors.accent,
  media: Colors.warning,
  baja: Colors.textMuted,
};

const CONFIDENCE_LABEL_EN: Record<string, string> = {
  alta: "High",
  media: "Medium",
  baja: "Low",
};

const PROVENANCE_LABEL: Record<string, string> = {
  sangre: "Backed by blood test data",
  wearable: "Backed by wearable data",
  sangre_y_wearable: "Backed by blood test + wearable data",
};

// "Your action plan" del último informe: acciones con el porqué, cómo hacerlo,
// avisos y la proyección del marcador a 6 meses. Se usa en el informe (/report-plan)
// y en "Full view" desde Today (/action-plan).
export const ActionPlanList = () => {
  const actionPlan = [...currentReport.action_plan].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned),
  );

  return (
    <View style={styles.actionList}>
      {actionPlan.map((item) => {
        const content = getActionPlanContentEn(item.action_id, {
          title: item.title,
          why: item.why,
          how: item.how,
          caveats: item.caveats,
        });
        return (
          <View key={item.action_id} style={styles.actionCard}>
            <View style={styles.actionHeader}>
              <Text style={styles.actionTitle}>{content.title}</Text>
              <View
                style={[
                  styles.confidenceBadge,
                  { backgroundColor: `${CONFIDENCE_COLOR[item.confidence]}22` },
                ]}
              >
                <Text
                  style={[
                    styles.confidenceText,
                    { color: CONFIDENCE_COLOR[item.confidence] },
                  ]}
                >
                  {CONFIDENCE_LABEL_EN[item.confidence]} confidence
                </Text>
              </View>
            </View>

            {content.why.map((line, i) => (
              <Text key={`why-${i}`} style={styles.actionWhy}>
                {line}
              </Text>
            ))}
            {content.how.map((line, i) => (
              <View key={`how-${i}`} style={styles.actionHowRow}>
                <Ionicons name="checkmark" size={14} color={Colors.accent} />
                <Text style={styles.actionHow}>{line}</Text>
              </View>
            ))}
            {content.caveats.map((line, i) => (
              <Text key={`caveat-${i}`} style={styles.actionCaveat}>
                ⚠ {line}
              </Text>
            ))}

            <View style={styles.projectionWrap}>
              <Text style={styles.projectionLabel}>
                Projected:{" "}
                {getMarkerDisplayNameEn(
                  item.estimated_next_test.marker_id,
                  item.estimated_next_test.marker_id.replace(/_/g, " "),
                )}
              </Text>
              <ProjectionChart
                currentValue={item.estimated_next_test.current_value}
                expectedValueIn6Months={
                  item.estimated_next_test.expected_value_in_6_months
                }
                expectedRangeLow={item.estimated_next_test.expected_range_low}
                expectedRangeHigh={item.estimated_next_test.expected_range_high}
              />
              <Text style={styles.uncertaintyNote}>
                {PROJECTION_UNCERTAINTY_NOTE_EN}
              </Text>
            </View>

            <Text style={styles.provenanceText}>
              {PROVENANCE_LABEL[item.provenance]}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  actionList: {
    paddingHorizontal: 20,
    gap: 14,
    marginTop: 10,
    marginBottom: 28,
  },
  actionCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
  },
  actionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  actionTitle: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: "700",
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  actionWhy: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  actionHowRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginBottom: 4,
  },
  actionHow: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
  },
  actionCaveat: {
    color: Colors.warning,
    fontSize: 11,
    marginTop: 6,
    lineHeight: 16,
  },
  projectionWrap: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  projectionLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 6,
  },
  uncertaintyNote: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 6,
    fontStyle: "italic",
  },
  provenanceText: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 10,
  },
});
