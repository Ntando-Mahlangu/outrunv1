import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { StrategicReview } from "@prisma/client";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#181818" },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#666666", marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: 700, marginTop: 18, marginBottom: 8 },
  item: { fontSize: 10, lineHeight: 1.4, marginBottom: 4 },
  paragraph: { fontSize: 10, lineHeight: 1.5 },
  muted: { fontSize: 9, color: "#666666" },
});

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.length === 0 ? (
        <Text style={styles.muted}>Nothing notable this period.</Text>
      ) : (
        items.map((item, i) => (
          <Text key={i} style={styles.item}>
            • {item}
          </Text>
        ))
      )}
    </View>
  );
}

const PERIOD_LABEL: Record<StrategicReview["period"], string> = {
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
};

export function buildStrategicReviewPdfDocument(organizationName: string, review: StrategicReview) {
  const achievements = review.achievements as string[];
  const missedOpportunities = review.missedOpportunities as string[];
  const risks = review.risks as string[];
  const keyLearnings = review.keyLearnings as string[];
  const recommendedPriorities = review.recommendedPriorities as string[];

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{organizationName}</Text>
        <Text style={styles.subtitle}>
          {PERIOD_LABEL[review.period]} Strategic Review · {review.periodStart.toDateString()} –{" "}
          {review.periodEnd.toDateString()}
        </Text>

        <Section title="Achievements" items={achievements} />
        <Section title="Missed Opportunities" items={missedOpportunities} />
        <Section title="Risks" items={risks} />
        <Section title="Key Learnings" items={keyLearnings} />
        <Section title="Recommended Priorities" items={recommendedPriorities} />

        <View>
          <Text style={styles.sectionTitle}>Next Growth Strategy</Text>
          <Text style={styles.paragraph}>{review.nextGrowthStrategy}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function strategicReviewToPdfBuffer(
  organizationName: string,
  review: StrategicReview,
): Promise<Buffer> {
  return renderToBuffer(buildStrategicReviewPdfDocument(organizationName, review));
}
