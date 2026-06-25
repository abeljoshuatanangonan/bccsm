<?php
session_start(); // ✅ Start session here at the very top
?>

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ministries | Bride of Christ Church: San Mateo</title>
  <link rel="icon" href="assets/images/bccsm logo.webp" type="image/webp">
  <link rel="stylesheet" href="assets/css/style.css">
  <link rel="stylesheet" href="assets/css/ministries.css">
  <link rel="stylesheet" href="assets/css/footer.css">
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Open+Sans+Condensed:wght@300;400;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">

</head>
<body class="homepage">
    
<!-- Header -->
 <?php include 'includes/header.php'; ?>

<!-- Sidebar -->
 <?php include 'includes/sidebar.php'; ?>
 
 <main id="main">
  
    <section class="ministries">
      <div class="ministries-inner">
        <h2 class="ministriespage-title">Ministries</h2>
      </div>

    <!-- Ministry 1 -->
     <section id="Administration"><hr><br>
     <div class="ministry-card">
      <div class="ministry-top">
        <img src="assets/images/sample img.png" alt="Administration">
        <div class="ministry-details">
          <h2>ADMINISTRATION</h2>
          <button class="join-btn">Join</button>
          <div class="objective">
            <strong>OBJECTIVE</strong>
            <p>Enriched ministry.<br><em>Pinalakas na ministeryo.</em></p>
          </div>
          <div class="task">
            <strong>TASK</strong>
            <p>Managing the properties, documents, and finances of the church.<br>
            <em>Pangangasiwa sa mga ari-arian, dokumento, at pananalapi ng simbahan.</em></p>
          </div>
        </div>
      </div>
      <p class="ministry-desc">
        The Administration Ministry plays a vital role in keeping the church well-organized
        and sustainable. It carefully manages the church’s properties, official documents,
        and financial resources with accountability and integrity. Through faithful stewardship,
        this ministry helps create a strong foundation that supports the work and growth of all
        other ministries.
      </p>
    </div>
    </section>

    <!-- Ministry 2 -->
    <section id="Children's-Ministry"><hr><br>
    <div class="ministry-card">
      <div class="ministry-top">
        <img src="assets/images/sample img.png" alt="Children's Ministry">
        <div class="ministry-details">
          <h2>CHILDREN’S MINISTRY</h2>
          <button class="join-btn">Join</button>
          <div class="objective">
            <strong>OBJECTIVE</strong>
            <p>Kids manifesting faith &amp; repentance.<br>
            <em>Mga bata na nagpapakita ng pananampalataya at pagsisisi.</em></p>
          </div>
          <div class="task">
            <strong>TASK</strong>
            <p>Teaching the Word of God to children aged 4–12 inside the church.<br>
            <em>Nagtuturo ng Salita ng Diyos sa mga bata 4-12 gulang sa loob ng iglesia.</em></p>
          </div>
        </div>
      </div>
      <p class="ministry-desc">
        The Children’s Ministry is devoted to nurturing young hearts in the love and truth of God.
        It teaches the Word of God to children ages 4 to 12, helping them understand the foundations
        of faith and the call to repentance. Through engaging lessons and Christ-centered guidance,
        this ministry equips kids to grow spiritually even at a young age.
      </p>
    </div>
    </section>

    <!-- Ministry 3 -->
    <section id="Church-Planting"><hr><br>
    <div class="ministry-card">
      <div class="ministry-top">
        <img src="assets/images/sample img.png" alt="Church Planting">
        <div class="ministry-details">
          <h2>CHURCH PLANTING</h2>
          <button class="join-btn">Join</button>
          <div class="objective">
            <strong>OBJECTIVE</strong>
            <p>House church establishment.<br>
            <em>Pagpapatatag ng simbahan sa bahay.</em></p>
          </div>
          <div class="task">
            <strong>TASK</strong>
            <p>Teaching the Good News and spiritual growth 'face-to-face' outside the church premises.<br>
            <em>Nagtuturo  “face-to-face” ng Mabuting Balita at paglagong esperitwal labas sa lugar ng iglesya.</em></p>
          </div>
        </div>
      </div>
      <p class="ministry-desc">
        The Church Planting Ministry focuses on establishing house churches to expand the reach of the 
        Gospel and provide intimate spaces for worship. Its primary objective is to create and nurture
         new house church communities where believers can grow in faith and fellowship. The task involves 
         teaching the Good News and guiding spiritual growth through personal, face-to-face interactions 
         outside the traditional church setting.
      </p>
    </div>
    </section>

    <!-- Ministry 4 -->
    <section id="Community-Works"><hr><br>
    <div class="ministry-card">
      <div class="ministry-top">
        <img src="assets/images/sample img.png" alt="Community Works">
        <div class="ministry-details">
          <h2>COMMUNITY WORKS</h2>
          <button class="join-btn">Join</button>
          <div class="objective">
            <strong>OBJECTIVE</strong>
            <p>Christian good works demonstrated as means to evangelism.<br>
            <em>Ang mga magandang gawa ng mga Kristiano ay ipinakita bilang mga paraan ng ebanghelismo.</em></p>
          </div>
          <div class="task">
            <strong>TASK</strong>
            <p>Providing service to the community.<br>
            <em>Nagbibigay serbisyo sa pamayanan.</em></p>
          </div>
        </div>
      </div>
      <p class="ministry-desc">
        The Community Works Ministry emphasizes showing Christ’s love through acts of service that become 
        a bridge for evangelism. Its objective is to demonstrate Christian good works as a practical 
        testimony of faith, drawing others closer to God. The task involves providing meaningful services 
        to the community, addressing both physical and spiritual needs.
      </p>
    </div>
    </section>

    <!-- Ministry 5 -->
    <section id="Creative-Arts"><hr><br>
    <div class="ministry-card">
      <div class="ministry-top">
        <img src="assets/images/sample img.png" alt="Creative Arts">
        <div class="ministry-details">
          <h2>CREATIVE ARTS</h2>
          <button class="join-btn">Join</button>
          <div class="objective">
            <strong>OBJECTIVE</strong>
            <p>Encouragement of others.<br>
            <em>Paghikayat sa iba.</em></p>
          </div>
          <div class="task">
            <strong>TASK</strong>
            <p>Sharing talent.<br>
            <em>Nagbabahagi ng talento.</em></p>
          </div>
        </div>
      </div>
      <p class="ministry-desc">
        The Creative Arts Ministry uses God-given talents in music, visual arts, and other creative expressions 
        to uplift and inspire people. Its objective is to encourage others by reflecting Christ’s message 
        through artistic means. The task centers on sharing these talents to glorify God and edify the 
        church community.
      </p>
    </div>
    </section>

    <!-- Ministry 6 -->
    <section id="D-Team"><hr><br>
    <div class="ministry-card">
      <div class="ministry-top">
        <img src="assets/images/sample img.png" alt="D Team">
        <div class="ministry-details">
          <h2>D TEAM</h2>
          <button class="join-btn">Join</button>
          <div class="objective">
            <strong>OBJECTIVE</strong>
            <p>Evangelism, equipping, empowerment, & expansion (maturity & multiplication).<br>
            <em>Pangangaral, pagsasanay, pagbibigay ng kapangyarihan, at pagpapalawak (paglago at pagpaparami).</em></p>
          </div>
          <div class="task">
            <strong>TASK</strong>
            <p>Overseeing the campaign, organizing, and leading for church groups to promote the reign of Christ in all.<br>
            <em>Nangangasiwa sa kampanya, pagbuo, at pamumuno para sa mga pang-iglesyang grupo para isulong ang paghahari 
              ni Cristo sa lahat.</em></p>
          </div>
        </div>
      </div>
      <p class="ministry-desc">
        The D Team Ministry is dedicated to strengthening the church through evangelism, discipleship, and 
        leadership development. Its objective is evangelism, equipping, empowerment, and expansion—fostering 
        both spiritual maturity and multiplication of believers. The task includes overseeing campaigns, 
        organizing activities, and leading church groups to advance the reign of Christ in every aspect of life.
      </p>
    </div>
    </section>

    <!-- Ministry 7 -->
    <section id="Iskwela-Suporta"><hr><br>
    <div class="ministry-card">
      <div class="ministry-top">
        <img src="assets/images/sample img.png" alt="Iskwela Suporta">
        <div class="ministry-details">
          <h2>ISKWELA SUPORTA</h2>
          <button class="join-btn">Join</button>
          <div class="objective">
            <strong>OBJECTIVE</strong>
            <p>Christian good works to leader-potential youths.<br>
            <em>Mga Christian na mabuting gawa para sa mga kabataang may potensyal na maging lider.</em></p>
          </div>
          <div class="task">
            <strong>TASK</strong>
            <p>Aids to asking for any help for studying.<br>
            <em>Nangingilak ng anumang tulong para sa pag-aaral.</em></p>
          </div>
        </div>
      </div>
      <p class="ministry-desc">
        The Iskwela Suporta Ministry seeks to invest in the next generation by supporting the educational 
        needs of young people with leadership potential. Its objective is to extend Christian good 
        works by guiding and assisting these youths as they grow in both character and knowledge. 
        The task involves providing aid and encouragement to students, including helping them seek 
        the resources they need for their studies.
      </p>
    </div>
    </section>

    <!-- Ministry 8 -->
    <section id="Kids'-Care"><hr><br>
    <div class="ministry-card">
      <div class="ministry-top">
        <img src="assets/images/sample img.png" alt="Kids' Care">
        <div class="ministry-details">
          <h2>KIDS' CARE</h2>
          <button class="join-btn">Join</button>
          <div class="objective">
            <strong>OBJECTIVE</strong>
            <p>Kids gathered, guarded, & guided.<br>
            <em>Ang mga bata ay nagtipon, inalagaan, at ginabayan.</em></p>
          </div>
          <div class="task">
            <strong>TASK</strong>
            <p>Caring for children especially in the ages 4-12.<br>
            <em>Nangangalaga sa mga bata lalo na sa mga gulang 4-12.</em></p>
          </div>
        </div>
      </div>
      <p class="ministry-desc">
        The Kids Care Ministry is focused on nurturing children in a safe and loving environment where they 
        can grow in faith. Its objective is to gather, guard, and guide kids in their early formative years. 
        The task involves caring for children, especially those aged 4 to 12, by teaching them biblical values 
        and providing wholesome activities.
      </p>
    </div>
    </section>

    <!-- Ministry 9 -->
    <section id="Membership"><hr><br>
    <div class="ministry-card">
      <div class="ministry-top">
        <img src="assets/images/sample img.png" alt="Membership">
        <div class="ministry-details">
          <h2>MEMBERSHIP</h2>
          <button class="join-btn">Join</button>
          <div class="objective">
            <strong>OBJECTIVE</strong>
            <p>Encouragement of others.<br>
            <em>Paghikayat sa iba.</em></p>
          </div>
          <div class="task">
            <strong>TASK</strong>
            <p>Bringing comfort and strength to the members who are in a tragedy.<br>
            <em>Nagdadala ng kaaliwan at kalakasang-loob sa mga kasapi na nasa isang trahedya.</em></p>
          </div>
        </div>
      </div>
      <p class="ministry-desc">
        The Membership Ministry is dedicated to building a supportive and caring church community. Its 
        objective is the encouragement of others, ensuring that no member feels alone in difficult times. 
        The task involves bringing comfort and strength to members who are experiencing tragedy, offering 
        both spiritual and emotional support.
      </p>
    </div>
    </section>

    <!-- Ministry 10 -->
    <section id="Prayer"><hr><br>
    <div class="ministry-card">
      <div class="ministry-top">
        <img src="assets/images/sample img.png" alt="Prayer">
        <div class="ministry-details">
          <h2>PRAYER</h2>
          <button class="join-btn">Join</button>
          <div class="objective">
            <strong>OBJECTIVE</strong>
            <p>Experience of the miraculous, extra-ordinary, supernatural, & outstanding.<br>
            <em>Karanasan ng nakakagulat, pambihira, supernatural, at hindi pangkaraniwan.</em></p>
          </div>
          <div class="task">
            <strong>TASK</strong>
            <p>Interceding to God in prayer for others.<br>
            <em>Namamagitan sa Diyos sa pananalangin para sa iba.</em></p>
          </div>
        </div>
      </div>
      <p class="ministry-desc">
        The Prayer Ministry centers on deepening the church’s relationship with God through consistent and 
        devoted prayer. Its objective is to experience the miraculous, extraordinary, supernatural, and 
        outstanding works of God. The task involves faithfully interceding to God in prayer on behalf of 
        others, lifting up their needs and concerns.
      </p>
    </div>
    </section>

    <!-- Ministry 11 -->
    <section id="Social-Media-Communications"><hr><br>
    <div class="ministry-card">
      <div class="ministry-top">
        <img src="assets/images/sample img.png" alt="Social Media Communications">
        <div class="ministry-details">
          <h2>SOCIAL MEDIA COMMUNICATIONS</h2>
          <button class="join-btn">Join</button>
          <div class="objective">
            <strong>OBJECTIVE</strong>
            <p>Information awareness & action.<br>
            <em>Kamamalayan at aksyon sa impormasyon.</em></p>
          </div>
          <div class="task">
            <strong>TASK</strong>
            <p>Communicating about important information.<br>
            <em>Nakikipagtalastasan ukol sa mga importanteng impormasyon.</em></p>
          </div>
        </div>
      </div>
      <p class="ministry-desc">
        The Social Media Communications Ministry serves as the church’s channel for sharing timely 
        and relevant updates. Its objective is to promote information awareness and encourage appropriate 
        action within the community. The task involves communicating important information clearly and 
        effectively through social media platforms.
      </p>
    </div>
    </section>

    <!-- Ministry 12 -->
    <section id="Social-Media-Evangelism"><hr><br>
    <div class="ministry-card">
      <div class="ministry-top">
        <img src="assets/images/sample img.png" alt="Social Media Evangelism & Discipleship">
        <div class="ministry-details">
          <h2>SOCIAL MEDIA EVANGELISM & DISCIPLESHIP</h2>
          <button class="join-btn">Join</button>
          <div class="objective">
            <strong>OBJECTIVE</strong>
            <p>Evangelism & follow-up.<br>
            <em>Pag-eebanghelyo at pagsubaybay.</em></p>
          </div>
          <div class="task">
            <strong>TASK</strong>
            <p>Witnessing and sharing the Good News using social media.<br>
            <em>Nagsasaksi at nagbabahagi ng Mabuting Balita gamit ang social media.</em></p>
          </div>
        </div>
      </div>
      <p class="ministry-desc">
        The Social Media Evangelism & Discipleship Ministry uses digital platforms to reach people with 
        the message of Christ. Its objective is evangelism and follow-up, ensuring that those who hear 
        the Good News are guided in their faith journey. The task involves witnessing and sharing the 
        Gospel through social media while also nurturing ongoing discipleship.
      </p>
    </div>
    </section>

    <!-- Ministry 13 -->
    <section id="Sports"><hr><br>
    <div class="ministry-card">
      <div class="ministry-top">
        <img src="assets/images/sportsministry.webp" alt="Sports">
        <div class="ministry-details">
          <h2>SPORTS</h2>
          <button class="join-btn">Join</button>
          <div class="objective">
            <strong>OBJECTIVE</strong>
            <p>Friendship towards faith.<br>
            <em>Pagkakaibigan tungo sa pananampalataya.</em></p>
          </div>
          <div class="task">
            <strong>TASK</strong>
            <p>Supervising sports games.<br>
            <em>Nangangasiwa ng palarong palakasan.</em></p>
          </div>
        </div>
      </div>
      <p class="ministry-desc">
        The Sports Ministry provides opportunities for fellowship and healthy recreation that build 
        connections among people. Its objective is to foster friendship that can lead others toward 
        faith in Christ. The task involves supervising sports games and using them as a platform for 
        encouragement, teamwork, and spiritual growth.
      </p>
    </div>
    </section>

    <!-- Ministry 14 -->
    <section id="Sunday-Service"><hr><br>
    <div class="ministry-card">
      <div class="ministry-top">
        <img src="assets/images/sample img.png" alt="Sunday Service">
        <div class="ministry-details">
          <h2>SUNDAY SERVICE</h2>
          <button class="join-btn">Join</button>
          <div class="objective">
            <strong>OBJECTIVE</strong>
            <p>Experience of God.<br>
            <em>Karanasan ng Diyos.</em></p>
          </div>
          <div class="task">
            <strong>TASK</strong>
            <p>Supervises parts of weekly worship.<br>
            <em>Nangangasiwa sa mga bahagi ng pananambahang panlinggo.</em></p>
          </div>
        </div>
      </div>
      <p class="ministry-desc">
        The Sunday Service Ministry ensures that the weekly worship gathering is orderly and uplifting. 
        Its objective is to help the congregation experience God in a meaningful and personal way. 
        The task involves supervising different parts of the Sunday service to create an atmosphere 
        of reverence and unity in worship.
      </p>
    </div>
    </section>

    <!-- Ministry 15 -->
    <section id="Support"><hr><br>
    <div class="ministry-card">
      <div class="ministry-top">
        <img src="assets/images/sample img.png" alt="Support">
        <div class="ministry-details">
          <h2>SUPPORT</h2>
          <button class="join-btn">Join</button>
          <div class="objective">
            <strong>OBJECTIVE</strong>
            <p>Demonstrating Christian good works.<br>
            <em>Pagpapakita ng mabubuting gawa ng Kristiyano.</em></p>
          </div>
          <div class="task">
            <strong>TASK</strong>
            <p>Providing assistance wherever needed.<br>
            <em>Nagbibigay tulong-serbisyo saan man may pangangailangan.</em></p>
          </div>
        </div>
      </div>
      <p class="ministry-desc">
        The Support Ministry is committed to extending help in practical and spiritual ways within 
        the church community. Its objective is to demonstrate Christian good works through acts of 
        service. The task involves providing assistance wherever needed, ensuring the smooth flow of 
        church activities and caring for others.
      </p>
    </div>
    </section>

    <!-- Ministry 16 -->
    <section id="Technical-Operation"><hr><br>
    <div class="ministry-card">
      <div class="ministry-top">
        <img src="assets/images/sample img.png" alt="Technical Operation">
        <div class="ministry-details">
          <h2>TECHNICAL OPERATION</h2>
          <button class="join-btn">Join</button>
          <div class="objective">
            <strong>OBJECTIVE</strong>
            <p>Encouragement of others.<br>
            <em>Paghikayat sa iba.</em></p>
          </div>
          <div class="task">
            <strong>TASK</strong>
            <p>Supervises sound, lighting, and visual equipment.<br>
            <em>Nangangasiwa sa kagamitang pantunog, pang-ilaw at bisyuwal.</em></p>
          </div>
        </div>
      </div>
      <p class="ministry-desc">
        The Technical Operation Ministry plays a vital role in creating an environment that supports 
        meaningful worship and fellowship. Its objective is the encouragement of others by ensuring 
        clear communication and a smooth worship experience. The task involves supervising sound, 
        lighting, and visual equipment to enhance services and events.
      </p>
    </div>
    </section>

    <!-- Ministry 17 -->
    <section id="Timothites'"><hr><br>
    <div class="ministry-card">
      <div class="ministry-top">
        <img src="assets/images/sample img.png" alt="Timothites'">
        <div class="ministry-details">
          <h2>TIMOTHITES'</h2>
          <button class="join-btn">Join</button>
          <div class="objective">
            <strong>OBJECTIVE</strong>
            <p>Evangelism, equipping, empowerment, exemplification, expansion.<br>
            <em>Ebanghelismo, pagsasanay, pagpapalakas, pagpapakita ng mabuting halimbawa, pagpapalawak.</em></p>
          </div>
          <div class="task">
            <strong>TASK</strong>
            <p>Training youth ages 13 and up to become servant-leaders.<br>
            <em>Naghuhubog sa mga kabataan 13 pataas para maging lingkod-tagapanguna.</em></p>
          </div>
        </div>
      </div>
      <p class="ministry-desc">
        The Timothites' Ministry is dedicated to raising up young believers who are passionate about serving 
        God and others. Its objective is evangelism, equipping, empowerment, exemplification, and expansion, 
        shaping them into mature disciples. The task involves training youth ages 13 and up to become 
        servant-leaders who embody Christlike character and leadership.
      </p>
    </div>
    </section>

    <!-- Ministry 18 -->
    <section id="Ushering"><hr><br>
    <div class="ministry-card">
      <div class="ministry-top">
        <img src="assets/images/sample img.png" alt="Ushering'">
        <div class="ministry-details">
          <h2>USHERING</h2>
          <button class="join-btn">Join</button>
          <div class="objective">
            <strong>OBJECTIVE</strong>
            <p>Providing Christian service during Christian service and fellowship.<br>
            <em>Ang pagbibigay ng Kristiyanong paglilingkod sa panahon ng Kristiyanong paglilingkod at pakikisama.</em></p>
          </div>
          <div class="task">
            <strong>TASK</strong>
            <p>Caring for those attending a Christian gathering.<br>
            <em>Nag-aasikaso sa mga dumadalo sa pagtitipong Cristiano.</em></p>
          </div>
        </div>
      </div>
      <p class="ministry-desc">
        The Ushering Ministry focuses on welcoming and assisting people during church services and gatherings. 
        Its objective is to provide Christian service during times of worship and fellowship. The task involves 
        caring for those attending, ensuring they feel comfortable, guided, and valued in the gathering.
      </p>
    </div>
    </section>

    <!-- Ministry 19 -->
    <section id="Worship"><hr><br>
    <div class="ministry-card">
      <div class="ministry-top">
        <img src="assets/images/sample img.png" alt="Worship'">
        <div class="ministry-details">
          <h2>WORSHIP</h2>
          <button class="join-btn">Join</button>
          <div class="objective">
            <strong>OBJECTIVE</strong>
            <p>Experience of God.<br>
            <em>Karanasan ng Diyos.</em></p>
          </div>
          <div class="task">
            <strong>TASK</strong>
            <p>Leading in praise and worship of God.<br>
            <em>Nangunguna sa papuri at pagsamba sa Diyos.</em></p>
          </div>
        </div>
      </div>
      <p class="ministry-desc">
        The Worship Ministry seeks to lead the congregation into God’s presence through heartfelt music 
        and praise. Its objective is to create an atmosphere where believers can experience God deeply. 
        The task involves guiding the church in praise and worship, helping everyone lift their hearts 
        and voices to Him.
      </p>
    </div>
    </section>
  </section>

 </main>

<!-- Footer -->
 <?php include 'includes/footer.php'; ?>
 
 <script src="assets/js/script.js"></script>
</body>
</html>