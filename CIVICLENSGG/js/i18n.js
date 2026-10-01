// Simple i18n utility for static HTML pages
(function(){
  const SUPPORTED = ['en','hi','ta','te','bn','kn','gu'];
  const EMBEDDED = {
    en: { "welcome_title":"Become a City Guardian","welcome_tagline":"Empower your community. One report at a time.","get_started_button":"Get Started","permissions_title":"Unlock Civic Power","permissions_tagline":"To help you make the biggest impact, CivicLens needs a few permissions.","permissions_location_title":"Pinpoint Issues","permissions_location_desc":"Automatically geotag reports for precise city action.","permissions_camera_title":"Capture Evidence","permissions_camera_desc":"Take photos and videos to show issues clearly.","grant_permissions_button":"Grant Permissions","home_select_category":"Select Category","home_scan_button":"Tap to Scan a Civic Issue","home_analyzing":"AI Analyzing...","home_severity_meter":"Severity Meter","home_report_button":"Report Issue","success_title":"Report Submitted!","view_my_reports_button":"View My Reports","report_another_issue_button":"Report Another Issue","my_reports_title":"My Reports","my_reports_all":"All","my_reports_in_progress":"In Progress","my_reports_resolved":"Resolved","report_details_title":"Report Details","nearby_issues_title":"Nearby Issues","impact_report_title":"My Impact Report","certificate_title":"Shareable Certificate","share_certificate_button":"Share Certificate","leaderboard_title":"Leaderboard","leaderboard_community":"Community","leaderboard_authority":"Authority","nav_home":"Home","nav_reports":"My Reports","nav_map":"Map","nav_impact":"My Impact","nav_leaderboard":"Leaderboard","category_waste":"Waste Management","category_waste_overflow":"Overflowing Public Bin","category_waste_plastic":"Plastic & Dry Recyclables","category_waste_organic":"Organic & Food Waste","category_waste_hazardous":"Hazardous & E-Waste","category_waste_litter":"Litter & Street Clutter",
    "tutorial_title":"CivicLens Quick Tutorial","tutorial_heading":"Your City, Your Impact","tutorial_subheading":"A quick guide to making a difference with just a few taps.","tutorial_step1_title":"Discover","tutorial_step1_desc":"Spot an issue? Just scan it.","tutorial_step2_title":"Scan","tutorial_step2_desc":"Our AI helps analyze and categorize the issue.","tutorial_step3_title":"Report","tutorial_step3_desc":"Submit your report and track its progress.","tutorial_cta":"Start Exploring" },
    hi: {"welcome_title":"शहर के संरक्षक बनें","welcome_tagline":"अपने समुदाय को सशक्त बनाएं। एक रिपोर्ट एक समय पर।","get_started_button":"शुरू करें","permissions_title":"नागरिक शक्ति अनलॉक करें","permissions_tagline":"सबसे बड़ा प्रभाव डालने के लिए, CivicLens को कुछ अनुमतियों की आवश्यकता है।","permissions_location_title":"समस्याएँ चिन्हित करें","permissions_location_desc":"सटीक शहर कार्रवाई के लिए रिपोर्ट को स्वचालित रूप से जियोटैग करें।","permissions_camera_title":"सबूत कैद करें","permissions_camera_desc":"समस्याओं को स्पष्ट रूप से दिखाने के लिए फोटो और वीडियो लें।","grant_permissions_button":"अनुमतियाँ दें","home_select_category":"श्रेणी चुनें","home_scan_button":"किसी नागरिक समस्या को स्कैन करें","home_analyzing":"एआई विश्लेषण कर रहा है...","home_severity_meter":"गंभीरता मीटर","home_report_button":"समस्या रिपोर्ट करें","success_title":"रिपोर्ट सबमिट हो गई!","view_my_reports_button":"मेरी रिपोर्ट देखें","report_another_issue_button":"एक और समस्या रिपोर्ट करें","my_reports_title":"मेरी रिपोर्ट","my_reports_all":"सभी","my_reports_in_progress":"प्रगति पर","my_reports_resolved":"सुलझाया गया","report_details_title":"रिपोर्ट विवरण","nearby_issues_title":"आस-पास की समस्याएँ","impact_report_title":"मेरी प्रभाव रिपोर्ट","certificate_title":"शेयर करने योग्य प्रमाणपत्र","share_certificate_button":"प्रमाणपत्र साझा करें","leaderboard_title":"लीडरबोर्ड","leaderboard_community":"समुदाय","leaderboard_authority":"प्राधिकरण","nav_home":"होम","nav_reports":"मेरी रिपोर्ट","nav_map":"मानचित्र","nav_impact":"मेरा प्रभाव","nav_leaderboard":"लीडरबोर्ड",
    "tutorial_title":"CivicLens त्वरित ट्यूटोरियल","tutorial_heading":"आपका शहर, आपका प्रभाव","tutorial_subheading":"बस कुछ टैप्स में बदलाव लाने की एक त्वरित गाइड।","tutorial_step1_title":"डिस्कवर","tutorial_step1_desc":"कोई समस्या दिखी? बस स्कैन करें।","tutorial_step2_title":"स्कैन","tutorial_step2_desc":"हमारा एआई समस्या का विश्लेषण और वर्गीकरण करता है।","tutorial_step3_title":"रिपोर्ट","tutorial_step3_desc":"अपनी रिपोर्ट सबमिट करें और प्रगति ट्रैक करें।","tutorial_cta":"शुरू करें"},
    ta: {"welcome_title":"நகர காவலராகுங்கள்","welcome_tagline":"உங்கள் சமூகத்தை வலுப்படுத்துங்கள். ஒவ்வொரு அறிக்கையுடன்.","get_started_button":"தொடங்கவும்","permissions_title":"சிவிக் சக்தியைத் திறக்கவும்","permissions_tag்லைன்":"உங்கள் தாக்கத்தை அதிகரிக்க, CivicLens-க்கு சில அனுமதிகள் தேவை.","permissions_location_title":"சிக்கல்களை சுட்டிக்காட்டுங்கள்","permissions_location_desc":"துல்லியமான நகரச் செயலில் ஜியோடேக் செய்யவும்.","permissions_camera_title":"ஆதாரங்களைப் பதிவு செய்யவும்","permissions_camera_desc":"சிக்கல்களைத் தெளிவாக காட்ட புகைப்படங்கள்/வீடியோக்கள் எடுக்கவும்.","grant_permissions_button":"அனுமதிகளை அளிக்கவும்","home_select_category":"வகையைத் தேர்ந்தெடுக்கவும்","home_scan_button":"சிவிக் பிரச்சனையை ஸ்கேன் செய்ய தட்டவும்","home_analyzing":"ஏஐ பகுப்பாய்வு செய்கிறது...","home_severity_meter":"கடுமை அளவுகோல்","home_report_button":"பிரச்சனையை புகார் செய்யவும்","success_title":"அறிக்கை சமர்ப்பிக்கப்பட்டது!","view_my_reports_button":"என் அறிக்கைகளைப் பார்க்க","report_another_issue_button":"மற்றொரு பிரச்சனையை புகார் செய்யவும்","my_reports_title":"என் அறிக்கைகள்","my_reports_all":"அனைத்தும்","my_reports_in_progress":"செயலில்","my_reports_resolved":"தீர்க்கப்பட்டது","report_details_title":"அறிக்கை விவரங்கள்","nearby_issues_title":"அருகிலுள்ள பிரச்சனைகள்","impact_report_title":"என் தாக்க அறிக்கை","certificate_title":"பகிரக்கூடிய சான்றிதழ்","share_certificate_button":"சான்றிதழை பகிரவும்","leaderboard_title":"லீடர்போர்டு","leaderboard_community":"சமூகம்","leaderboard_authority":"அதிகாரம்","nav_home":"முகப்பு","nav_reports":"என் அறிக்கைகள்","nav_map":"வரைபடம்","nav_impact":"என் தாக்கம்","nav_leaderboard":"லீடர்போர்டு",
    "tutorial_title":"CivicLens விரைவு பயிலரங்கு","tutorial_heading":"உங்கள் நகரம், உங்கள் தாக்கம்","tutorial_subheading":"சில தட்டுதல்களிலேயே மாற்றம் செய்யும் ஒரு விரைவு வழிகாட்டி.","tutorial_step1_title":"கண்டறிதல்","tutorial_step1_desc":"ஒரு சிக்கலா? உடனே ஸ்கேன் செய்யுங்கள்.","tutorial_step2_title":"ஸ்கேன்","tutorial_step2_desc":"எங்கள் ஏஐ சிக்கலை பகுப்பாய்த்து வகைப்படுத்துகிறது.","tutorial_step3_title":"அறிக்கை","tutorial_step3_desc":"உங்கள் அறிக்கையை சமர்ப்பித்து முன்னேற்றத்தை கண்காணிக்கவும்.","tutorial_cta":"தொடங்கவும்"},
    te: {"welcome_title":"సిటీ గార్డియన్ అవ్వండి","welcome_tagline":"మీ సమాజాన్ని శక్తివంతం చేయండి. ఒక్కో రిపోర్ట్‌తో.","get_started_button":"ప్రారంభించండి","permissions_title":"పౌర శక్తిని అన్‌లాక్ చేయండి","permissions_tagline":"మీ ప్రభావాన్ని పెంచడానికి, CivicLens కి కొన్ని అనుమతులు అవసరం.","permissions_location_title":"సమస్యలను గుర్తించండి","permissions_location_desc":"నగర చర్య కోసం నివేదికలను ఆటోమేటిక్‌గా జియోట్యాగ్ చేయండి.","permissions_camera_title":"సాక్ష్యాలను సేకరించండి","permissions_camera_desc":"సమస్యలను స్పష్టంగా చూపేందుకు ఫోటోలు, వీడియోలు తీయండి.","grant_permissions_button":"అనుమతులు ఇవ్వండి","home_select_category":"వర్గాన్ని ఎంచుకోండి","home_scan_button":"పౌర సమస్యను స్కాన్ చేయడానికి ట్యాప్ చేయండి","home_analyzing":"ఎఐ విశ్లేషిస్తోంది...","home_severity_meter":"తీవ్రత మీటర్","home_report_button":"సమస్యను నివేదించండి","success_title":"రిపోర్ట్ సమర్పించబడింది!","view_my_reports_button":"నా రిపోర్ట్స్ చూడండి","report_another_issue_button":"మరొక సమస్యను నివేదించండి","my_reports_title":"నా రిపోర్ట్స్","my_reports_all":"అన్నీ","my_reports_in_progress":"పనిలో ఉంది","my_reports_resolved":"పరిష్కరించబడింది","report_details_title":"రిపోర్ట్ వివరాలు","nearby_issues_title":"దగ్గరలోని సమస్యలు","impact_report_title":"నా ప్రభావ నివేదిక","certificate_title":"షేర్ చేయగల సర్టిఫికేట్","share_certificate_button":"సర్టిఫికేట్ షేర్ చేయండి","leaderboard_title":"లీడర్‌బోర్డ్","leaderboard_community":"సమాజం","leaderboard_authority":"అధికారులు","nav_home":"హోమ్","nav_reports":"నా రిపోర్ట్స్","nav_map":"మ్యాప్","nav_impact":"నా ప్రభావం","nav_leaderboard":"లీడర్‌బోర్డ్",
    "tutorial_title":"CivicLens త్వరిత ట్యుటోరియల్","tutorial_heading":"మీ నగరం, మీ ప్రభావం","tutorial_subheading":"కొన్ని ట్యాప్‌ల్లో మార్పు తీసుకురావడానికి త్వరిత మార్గదర్శిని.","tutorial_step1_title":"కనుగొను","tutorial_step1_desc":"సమస్య కనిపించిందా? వెంటనే స్కాన్ చేయండి.","tutorial_step2_title":"స్కాన్","tutorial_step2_desc":"మా ఎఐ సమస్యను విశ్లేషించి వర్గీకరిస్తుంది.","tutorial_step3_title":"నివేదించండి","tutorial_step3_desc":"మీ నివేదికను సమర్పించి పురోగతిని ట్రాక్ చేయండి.","tutorial_cta":"ప్రారంభించండి"},
    bn: {"welcome_title":"সিটি গার্ডিয়ান হন","welcome_tagline":"আপনার কমিউনিটিকে ক্ষমতায়ন করুন। এক সময়ে একটি রিপোর্ট।","get_started_button":"শুরু করুন","permissions_title":"সিভিক শক্তি আনলক করুন","permissions_tagline":"আপনার প্রভাব সর্বাধিক করতে, CivicLens-এর কয়েকটি অনুমতি প্রয়োজন।","permissions_location_title":"সমস্যা চিহ্নিত করুন","permissions_location_desc":"সঠিক শহরের পদক্ষেপের জন্য স্বয়ংক্রিয়ভাবে জিওট্যাগ করুন।","permissions_camera_title":"প্রমাণ সংগ্রহ করুন","permissions_camera_desc":"সমস্যাগুলি স্পষ্টভাবে দেখাতে ছবি ও ভিডিও তুলুন।","grant_permissions_button":"অনুমতি দিন","home_select_category":"বিভাগ নির্বাচন করুন","home_scan_button":"একটি সিভিক সমস্যা স্ক্যান করতে ট্যাপ করুন","home_analyzing":"এআই বিশ্লেষণ করছে...","home_severity_meter":"তীব্রতা মিটার","home_report_button":"সমস্যা রিপোর্ট করুন","success_title":"রিপোর্ট জমা হয়েছে!","view_my_reports_button":"আমার রিপোর্ট দেখুন","report_another_issue_button":"আরেকটি সমস্যা রিপোর্ট করুন","my_reports_title":"আমার রিপোর্টসমূহ","my_reports_all":"সব","my_reports_in_progress":"চলমান","my_reports_resolved":"সমাধান হয়েছে","report_details_title":"রিপোর্টের বিবরণ","nearby_issues_title":"কাছাকাছি সমস্যা","impact_report_title":"আমার প্রভাব প্রতিবেদন","certificate_title":"শেয়ারযোগ্য শংসাপত্র","share_certificate_button":"শংসাপত্র শেয়ার করুন","leaderboard_title":"লিডারবোর্ড","leaderboard_community":"কমিউনিটি","leaderboard_authority":"কর্তৃপক্ষ","nav_home":"হোম","nav_reports":"আমার রিপোর্ট","nav_map":"মানচিত্র","nav_impact":"আমার প্রভাব","nav_leaderboard":"লিডারবোর্ড",
    "tutorial_title":"CivicLens দ্রুত টিউটোরিয়াল","tutorial_heading":"আপনার শহর, আপনার প্রভাব","tutorial_subheading":"কয়েকটি ট্যাপে পরিবর্তন আনার একটি দ্রুত গাইড।","tutorial_step1_title":"আবিষ্কার","tutorial_step1_desc":"সমস্যা দেখলেন? স্ক্যান করুন।","tutorial_step2_title":"স্ক্যান","tutorial_step2_desc":"আমাদের এআই সমস্যা বিশ্লেষণ ও শ্রেণীবদ্ধ করে।","tutorial_step3_title":"রিপোর্ট","tutorial_step3_desc":"রিপোর্ট সাবমিট করুন এবং অগ্রগতি ট্র্যাক করুন।","tutorial_cta":"শুরু করুন"},
    kn: {"welcome_title":"ನಗರ ರಕ್ಷಕರಾಗಿರಿ","welcome_tagline":"ನಿಮ್ಮ ಸಮುದಾಯವನ್ನು ಸಬಲಗೊಳಿಸಿ. ಒಂದೊಂದೇ ವರದಿಯ ಮೂಲಕ.","get_started_button":"ಪ್ರಾರಂಭಿಸಿ","permissions_title":"ನಾಗರಿಕ ಶಕ್ತಿಯನ್ನು ಅನ್ಲಾಕ್ ಮಾಡಿ","permissions_tagline":"ನಿಮ್ಮ ಪ್ರಭಾವ ಹೆಚ್ಚಿಸಲು, CivicLens ಗೆ ಕೆಲವು ಅನುಮತಿಗಳು ಅಗತ್ಯ.","permissions_location_title":"ಸಮಸ್ಯೆಗಳನ್ನು ಗುರುತಿಸಿ","permissions_location_desc":"ನಗರ ಕ್ರಮಕ್ಕಾಗಿ ವರದಿಗಳನ್ನು ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಜಿಯೋಟ್ಯಾಗ್ ಮಾಡಿ.","permissions_camera_title":"ಸಾಕ್ಷ್ಯವನ್ನು ಸಂಗ್ರಹಿಸಿ","permissions_camera_desc":"ಸಮಸ್ಯೆಗಳನ್ನು ಸ್ಪಷ್ಟವಾಗಿ ತೋರಿಸಲು ಫೋಟೋ/ವೀಡಿಯೊ ತೆಗೆಯಿರಿ.","grant_permissions_button":"ಅನುಮತಿಗಳನ್ನು ನೀಡಿ","home_select_category":"ವರ್ಗವನ್ನು ಆಯ್ಕೆಮಾಡಿ","home_scan_button":"ಸಿವಿಕ್ ಸಮಸ್ಯೆಯನ್ನು ಸ್ಕ್ಯಾನ್ ಮಾಡಲು ಟ್ಯಾಪ್ ಮಾಡಿ","home_analyzing":"ಎಐ ವಿಶ್ಲೇಷಿಸುತ್ತಿದೆ...","home_severity_meter":"ತೀವ್ರತಾ ಮೀಟರ್","home_report_button":"ಸಮಸ್ಯೆಯನ್ನು ವರದಿ ಮಾಡಿ","success_title":"ವರದಿ ಸಲ್ಲಿಸಲಾಗಿದೆ!","view_my_reports_button":"ನನ್ನ ವರದಿಗಳನ್ನು ನೋಡಿ","report_another_issue_button":"ಇನ್ನೊಂದು ಸಮಸ್ಯೆಯನ್ನು ವರದಿ ಮಾಡಿ","my_reports_title":"ನನ್ನ ವರದಿಗಳು","my_reports_all":"ಎಲ್ಲ","my_reports_in_progress":"ಪ್ರಗತಿಯಲ್ಲಿದೆ","my_reports_resolved":"ಪರಿಹರಿಸಲಾಗಿದೆ","report_details_title":"ವರದಿ ವಿವರಗಳು","nearby_issues_title":"ಸಮೀಪದ ಸಮಸ್ಯೆಗಳು","impact_report_title":"ನನ್ನ ಪ್ರಭಾವ ವರದಿ","certificate_title":"ಹಂಚಬಹುದಾದ ಪ್ರಮಾಣಪತ್ರ","share_certificate_button":"ಪ್ರಮಾಣಪತ್ರ ಹಂಚಿಕೆ","leaderboard_title":"ಲೀಡರ್ಬೋರ್ಡ್","leaderboard_community":"ಸಮುದಾಯ","leaderboard_authority":"ಅಧಿಕಾರ","nav_home":"ಮುಖಪುಟ","nav_reports":"ನನ್ನ ವರದಿಗಳು","nav_map":"ನಕ್ಷೆ","nav_impact":"ನನ್ನ ಪ್ರಭಾವ","nav_leaderboard":"ಲೀಡರ್ಬೋರ್ಡ್",
    "tutorial_title":"CivicLens ತ್ವರಿತ ಪಾಠ","tutorial_heading":"ನಿಮ್ಮ ನಗರ, ನಿಮ್ಮ ಪ್ರಭಾವ","tutorial_subheading":"ಕೆಲವು ಟ್ಯಾಪ್‌ಗಳಲ್ಲಿ ಬದಲಾವಣೆ ಮಾಡಲು ದ್ರುತ ಮಾರ್ಗದರ್ಶಿ.","tutorial_step1_title":"ಹುಡುಕು","tutorial_step1_desc":"ಸಮಸ್ಯೆ ಕಾಣಿಸಿದೆಯೇ? ಕೂಡಲೇ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ.","tutorial_step2_title":"ಸ್ಕ್ಯಾನ್","tutorial_step2_desc":"ನಮ್ಮ ಎಐ ಸಮಸ್ಯೆಯನ್ನು ವಿಶ್ಲೇಷಿಸಿ ವರ್ಗೀಕರಿಸುತ್ತದೆ.","tutorial_step3_title":"ವರದಿ","tutorial_step3_desc":"ನಿಮ್ಮ ವರದಿಯನ್ನು ಸಲ್ಲಿಸಿ ಮತ್ತು ಪ್ರಗತಿಯನ್ನು ಅನುಸರಿಸಿ.","tutorial_cta":"ಪ್ರಾರಂಭಿಸಿ"},
    gu: {"welcome_title":"સિટી ગાર્ડિયન બનો","welcome_tagline":"તમારા સમુદાયને સશક્ત બનાવો. એક વખતમાં એક રિપોર્ટ.","get_started_button":"શરૂ કરો","permissions_title":"નાગરિક શક્તિ અનલોક કરો","permissions_tagline":"તમારો પ્રભાવ વધારવા માટે, CivicLens ને કેટલીક પરવાનગીઓની જરૂર છે.","permissions_location_title":"સમસ્યાઓ ઓળખો","permissions_location_desc":"ચોક્કસ શહેરની કાર્યવાહી માટે રિપોર્ટોને આપમેળે જિયોટેગ કરો.","permissions_camera_title":"પુરાવા કેદ કરો","permissions_camera_desc":"સમસ્યાઓ સ્પષ્ટ રીતે બતાવવા ફોટા/વિડિઓ લો.","grant_permissions_button":"પરવાનગીઓ આપો","home_select_category":"શ્રેણી પસંદ કરો","home_scan_button":"સિવિક સમસ્યા સ્કેન કરવા ટેપ કરો","home_analyzing":"એઆઈ વિશ્લેષણ કરી રહ્યું છે...","home_severity_meter":"તીવ્રતા મીટર","home_report_button":"સમસ્યા રિપોર્ટ કરો","success_title":"રિપોર્ટ સબમિટ થયો!","view_my_reports_button":"મારા રિપોર્ટ જુઓ","report_another_issue_button":"બીજી સમસ્યા રિપોર્ટ કરો","my_reports_title":"મારા રિપોર્ટ્સ","my_reports_all":"બધા","my_reports_in_progress":"પ્રગતિમાં","my_reports_resolved":"ઉકેલાયું","report_details_title":"રિપોર્ટ વિગતો","nearby_issues_title":"નજીકની સમસ્યાઓ","impact_report_title":"મારી અસર રિપોર્ટ","certificate_title":"શેર કરી શકાય તેવું પ્રમાણપત્ર","share_certificate_button":"પ્રમાણપત્ર શેર કરો","leaderboard_title":"લીડરબોર્ડ","leaderboard_community":"સમુદાય","leaderboard_authority":"અધિકાર","nav_home":"હોમ","nav_reports":"મારા રિપોર્ટ્સ","nav_map":"નકશો","nav_impact":"મારી અસર","nav_leaderboard":"લીડરબોર્ડ",
    "tutorial_title":"CivicLens ઝડપી ટ્યુટોરિયલ","tutorial_heading":"તમારું શહેર, તમારો પ્રભાવ","tutorial_subheading":"થોડા ટેપમાં બદલાવ લાવવા માટે ઝડપી માર્ગદર્શિકા.","tutorial_step1_title":"શોધો","tutorial_step1_desc":"સમસ્યા દેખાય છે? તરત સ્કેન કરો.","tutorial_step2_title":"સ્કેન","tutorial_step2_desc":"અમારું એઆઈ સમસ્યાનો વિશ્લેષણ અને વર્ગીકરણ કરે છે.","tutorial_step3_title":"રિપોર્ટ","tutorial_step3_desc":"તમારો રિપોર્ટ સબમિટ કરો અને પ્રગતિ ટ્રેક કરો.","tutorial_cta":"શરૂ કરો"}
  };

  function getLanguage(){
    try { return localStorage.getItem('lang') || 'en'; } catch(_) { return 'en'; }
  }

  function setLanguage(lang){
    const code = SUPPORTED.includes(lang) ? lang : 'en';
    try { localStorage.setItem('lang', code); } catch(_) {}
    applyTranslations();
  }

  async function fetchLocale(code){
    try {
      const url = `./locales/${code}.json`;
      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) throw new Error('net');
      return await resp.json();
    } catch (_) {
      return EMBEDDED[code] || EMBEDDED.en || {};
    }
  }

  async function loadTranslations(lang){
    const code = SUPPORTED.includes(lang) ? lang : 'en';
    return await fetchLocale(code);
  }

  function syncSelectors(lang){
    document.querySelectorAll('select[data-lang-selector]').forEach(sel => { sel.value = lang; });
  }

  function ensureOptions(sel){
    if (sel.options && sel.options.length > 0) return;
    const options = [
      {v:'en', t:'English'},
      {v:'hi', t:'हिन्दी'},
      {v:'ta', t:'தமிழ்'},
      {v:'te', t:'తెలుగు'},
      {v:'bn', t:'বাংলা'},
      {v:'kn', t:'ಕನ್ನಡ'},
      {v:'gu', t:'ગુજરાતી'}
    ];
    options.forEach(o => {
      const opt = document.createElement('option');
      opt.value = o.v; opt.textContent = o.t; sel.appendChild(opt);
    });
  }

  function wireSelectors(){
    document.querySelectorAll('select[data-lang-selector]').forEach(sel => {
      ensureOptions(sel);
      if (sel.__wiredLangSel) return;
      sel.addEventListener('change', function(){ setLanguage(this.value); });
      sel.__wiredLangSel = true;
    });
  }

  async function applyTranslations(){
    const lang = getLanguage();
    let dict = {};
    try { dict = await loadTranslations(lang); } catch(_) { dict = EMBEDDED.en || {}; }
    document.querySelectorAll('[data-i18n-key]').forEach(el => {
      const key = el.getAttribute('data-i18n-key');
      if (!key) return;
      if (Object.prototype.hasOwnProperty.call(dict, key)) {
        el.textContent = dict[key];
      }
    });
    wireSelectors();
    syncSelectors(lang);
  }

  window.CivicI18n = { setLanguage, getLanguage, applyTranslations };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyTranslations);
  } else {
    applyTranslations();
  }
})();


