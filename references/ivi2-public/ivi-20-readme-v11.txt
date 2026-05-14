 
Version 1.1 
Date: 2025-05-11 
 
 
 
 
 
 
 
 
README 
INITIAL VEHICLE INFORMATION 2.0 
 
 

Page 2 of 4 
 
 
 
NEW EUROPEAN REGULATIONS 
The Initial Vehicle Information (IVI) format is now a common format for exchanging vehicle data in several 
Member States. This has also been laid down in EU regulations. The European Regulation 2018/858, and the 
accompanying Implementing Regulations 2021/133 and 2024/1061, include various requirements relating to 
the eCoC. These regulations can be viewed via the website: https://eur-lex.europa.eu/ 
With the obligation to provide the eCoC’s in digital format, the IVI (vehicle) message has been re-examined 
within the EREG in cooperation with the manufacturers. Various optimizations have been implemented that have 
an impact on application of the data. 
 
OVERVIEW OF THE MOST IMPORTANT CHANGES 
 
OBLIGATION TO USE ECOC 
EU Regulation 2018/858 makes the use of an eCoC mandatory as of 5th July 2026. A paper CoC is no longer 
an obligation from that date onwards, but can still be requested in exceptional cases. The obligation to provide 
an eCoC does not apply to the European and National small series vehicles. 
Within the EREG, it has been decided that the rule that an eCoC is provided in the new format for vehicles 
produced from 5 July 2026 also applies to the categories that fall under the 168/2013 and 167/2013 vehicle 
categories. However, under these guidelines, an eCoC is not mandatory, here paper is still allowed in all cases. 
As a result, if a digital format it used, these eCvOs must be converted to version 2.0 and must meet the 
requirements set for version 2.0. This also applies to the signing of the eCoC file. 
 
OBLIGATION TO SIGN DIGITALLY 
From 5th July 2026, the obligation to sign the eCoC XML message will take effect. Without digital signing, the 
messages will no longer be processed. This means that this obligation takes effect as soon as an IVI version 2.0 is 
applied by a manufacturer. Regardless of the framework directive. 
It is important that the party who signs the file must always be the Manufacturer or EU representative as 
indicated in the Type Approval. 
The signature must then meet the requirements as set out in REGULATION (EU) No 910/2014, which means that it 
must be signed in accordance with the eIDAS standard. It has been decided that an Advanced certificate is 
sufficient for signing. A Qualified certificate which meets this standard is also allowed. 
 
More information about eIDas and providers can be found here: eIDAS Dashboard (europa.eu) 
 
 

Page 3 of 4 
 
 
CHANGES TO ECOC DATA 
The current IVI message has been developed in 2016 and contains data that is no longer current. Several 
corrections have also been made since version 1.0 and it has been established that structural changes are also 
needed. With the new regulations coming into force, it has been decided to also look at the structure and adjust 
it where necessary. As a result, the message is no longer "backwards compatible" as has been the case so far.  
The most important changes at a glance: 
1. 
The new message version 2.0 only contains the CoC data. 
2. 
The design of the data groups is set up, as much as possible, in accordance with EU regulations. 
3. 
The national and technical data group have been removed. 
4. 
The naming and layout of the attributes in the message have been adjusted in accordance with EU 
regulations. 
5. 
In some cases, data has changed its definition (length, etc.). 
6. 
In some cases, data has been placed on a different level (e.g. from fuel to vehicle and vice versa). 
7. 
In some cases enumerations have been changed. 
Documentation: 
IVI 2.0 Change Overview v1.0 
Document describing the changes made in addition to the “IVI 2.0 Overview transition From IVI 1.10-To-
2.0 v1.0”. 
IVI 2.0 Guidelines Initial Vehicle Information v1.0 
Overview of the guidelines on how to deal with the new version. These will be described in more detail 
in a user manual. 
IVI 2.0 Overview transition From IVI 1.10-To-2.0 v1.0 
All changes in an excel overview and a description of the link between IVI version 1.x and version 2.0. 
IVI 2.0 Initial Vehicle Information XSD Scheme 
The new XSD version 2.0 XSD file. 
IVI 2.0 Draft ICM Checking Module - version 0.9 
First draft with proposals for expansion of the ICM control module. 
TIMELINES 
Changes have been made to the timelines for setting up the message book and the ICM. These take more time 
than initially expected.  
Date 
Activity 
Comments 
January 2025 
Documentation published 
ChangeOverview IVI 2.0 v.1.0 
Guidelines Initial Vehicle Information Version 2.0 v1.0 
Overview transition From IVI 1.10-To-2.0 v1.0 
Initialvehicleinformation2.0.xsd 
11th May 2025 
Finish version 2.0 IVI 
Publication of final version of IVI 2.0 and documentation. 
11th May 2025 
Publication first draft ICM 
checks excel overview 
Excel overview with checks for IVI 2.0. 
15th July 2025 
Finish new version ICM 
The version will contain more rules then the previous 
version. It will also be published as a cloud solution for 
everyone to use . In this way, manufacturers can check 
eCoC files in advance. 
15st July 2025 
Finish messagebook 
Delivering the first version of the new message book. 
1st September 2025 
Using IVI version 2.0 
Possibility for manufacturers to already switch to version 
2.0. This is not yet an obligation. It must be possible for 
member states to be able to handle the new version. 

Page 4 of 4 
 
 
Date 
Activity 
Comments 
5th July 2026 
Mandatory use of eCoC 
Mandatory use of IVI version 2.0 for all vehicles 
manufactured after 5 July 2026. This applies to all 
manufacturers who supply a digital CoC. 
5th July 2026 
Publication of eCoC 
Mandatory access to eCoCs for the public. 
 
 
MORE INFORMATION OR QUESTIONS? 
For more information or questions about the timelines or use of the IVI message version 2.0, please contact the 
Member State to which you already provide eCoC’s. 
 
 
 
 
 
 
