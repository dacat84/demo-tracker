---
layout: default
title: Updates
nav: updates
---

<div class="updates">

<h2 class="updates-title" data-en="Trail Updates" data-de="Trail-Updates">Trail Updates</h2>
{% assign items = site.updates | sort: "date" | reverse %}
{% assign months_de = "Januar,Februar,März,April,Mai,Juni,Juli,August,September,Oktober,November,Dezember" | split: "," %}
{% for u in items %}{% assign mi = u.date | date: "%-m" | minus: 1 %}{% assign date_en = u.date | date: "%B %-d, %Y" %}{% capture date_de %}{{ u.date | date: "%-d" }}. {{ months_de[mi] }} {{ u.date | date: "%Y" }}{% endcapture %}
<div class="update-card">
<div class="update-date" data-en="{{ date_en }}" data-de="{{ date_de }}">{{ date_en }}</div>
<div class="update-text" data-en="{{ u.en | escape }}" data-de="{{ u.de | escape }}">{{ u.en | escape }}</div>
</div>
{% endfor %}
<div class="update-note" data-en="(Older updates at the bottom)" data-de="(Ältere Updates unten)">(Older updates at the bottom)</div>

</div>
