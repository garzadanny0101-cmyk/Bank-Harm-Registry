window.BHR_CONFIG = Object.freeze({
  contactEmail: "",
  privacyEmail: "",
  classEvent: {
    donationAmount: 20,
    portfolioAddOnAmount: 10,
    minimumConfirmed: 25,
    targetConfirmed: 50,
    plannedDurationHours: 3,
    maximumDurationHours: 5,
    cashAppUrl: "https://cash.app/$dginktattoos",
    contactEmail: "garzadanny0101@gmail.com",
    telegramUrl: "",
    tiktokProofUrl: "",
    eventDate: "", // ISO date/time with offset, e.g. YYYY-MM-DDTHH:mm:ss-04:00
    eventTimeZone: "America/New_York",
    cohortPolicy: "", // Owner-approved scheduling/refund terms; no invented policy.
    proofItems: [
      {
        reviewed: true,
        category: "Company response",
        title: "The response names the deletions.",
        summary: "An organizer-supplied Equifax response screenshot lists several tradeline deletions alongside other investigation results.",
        sourceUrl: "assets/Win_EQ-Credit_CFPB_all_Deletions.jpg",
        image: { src: "assets/Win_EQ-Credit_CFPB_all_Deletions.jpg", alt: "Supplied Equifax response screenshot highlighting deleted tradelines and other investigation results.", width: 820, height: 656 }
      },
      {
        reviewed: true,
        category: "Credit reporting change",
        title: "A collection marked removed.",
        summary: "A supplied Credit Karma screenshot reports removal of a Credit Management Company collection between October 7 and 17, 2025.",
        sourceUrl: "assets/Win_CFPB_Credit Karma.jpg",
        image: { src: "assets/Win_CFPB_Credit Karma.jpg", alt: "Supplied Credit Karma screenshot showing a Credit Management Company collection removed in October 2025.", width: 1078, height: 1564 }
      },
      {
        reviewed: true,
        category: "Score movement",
        title: "A +71-point change shown.",
        summary: "A supplied screenshot shows a 682 score, a +71-point change, and account removals. It does not establish what caused the score movement.",
        sourceUrl: "assets/Win_Testimony_Telegram_CK.jpg",
        image: { src: "assets/Win_Testimony_Telegram_CK.jpg", alt: "Supplied credit dashboard screenshot showing score 682, a 71-point increase, and multiple account removals.", width: 1080, height: 2340 }
      }
    ], // Content/privacy reviewed; not independently authenticated. See setup guide.
    previewVideo: null // Local video, poster, captions and transcript; see setup guide.
  },
  donationLinks: {
    defender7: "",
    builder25: "",
    advocate97: "",
    monthly: ""
  }
});
